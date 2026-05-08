import { prisma } from '@config/prisma';
import { parseLimit } from '@utils/pagination';
import { publicUserSelect } from '@modules/shared';
import { getSocketServer } from '@sockets/io';

// All supported notification types (mirrors NotificationType enum)
const ALL_TYPES = ['FOLLOW', 'LIKE', 'REPOST', 'COMMENT', 'MENTION', 'MESSAGE', 'REPLY', 'COMMENT_LIKE'] as const;
type NType = (typeof ALL_TYPES)[number];

export class NotificationsService {
  // ─────────────────────────────────────────────────────────────────────────
  // Listing
  // ─────────────────────────────────────────────────────────────────────────

  /** Returns the user's notifications with cursor pagination and optional type filtering. */
  async list(userId: string, cursor?: string, limitInput?: string, type?: string) {
    const limit = parseLimit(limitInput, 20, 50);
    const notifications = await prisma.notification.findMany({
      where: {
        recipientId: userId,
        ...(type ? { type: type as never } : {})
      },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: publicUserSelect } }
    });

    const hasMore = notifications.length > limit;
    const pageItems = hasMore ? notifications.slice(0, limit) : notifications;
    return { items: pageItems, pagination: { nextCursor: pageItems.at(-1)?.id ?? null, hasMore } };
  }

  /** Returns the unread notification count (used for badge display). */
  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await prisma.notification.count({ where: { recipientId: userId, isRead: false } });
    return { count };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Read / Delete
  // ─────────────────────────────────────────────────────────────────────────

  /** Marks all notifications as read. */
  async markAllRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({ where: { recipientId: userId, isRead: false }, data: { isRead: true } });
  }

  /** Marks a single notification as read. */
  async markOneRead(userId: string, notificationId: string): Promise<void> {
    const notification = await prisma.notification.findFirst({ where: { id: notificationId, recipientId: userId } });
    if (!notification) throw new Error('Notification not found');
    await prisma.notification.update({ where: { id: notificationId }, data: { isRead: true } });
  }

  /** Deletes a single notification for the user. */
  async deleteOne(userId: string, notificationId: string): Promise<void> {
    const notification = await prisma.notification.findFirst({ where: { id: notificationId, recipientId: userId } });
    if (!notification) throw new Error('Notification not found');
    await prisma.notification.delete({ where: { id: notificationId } });
  }

  /** Deletes all read notifications for the user. */
  async deleteAllRead(userId: string): Promise<void> {
    await prisma.notification.deleteMany({ where: { recipientId: userId, isRead: true } });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Preferences
  // ─────────────────────────────────────────────────────────────────────────

  /** Returns the user's notification preferences for all types. */
  async getPreferences(userId: string) {
    const stored = await prisma.notificationPreference.findMany({ where: { userId } });
    const storedMap = new Map(stored.map((p) => [p.type, p.enabled]));

    // Return a full list — types with no DB row default to enabled: true
    return ALL_TYPES.map((type) => ({
      type,
      enabled: storedMap.has(type) ? storedMap.get(type)! : true
    }));
  }

  /**
   * Upserts a single notification preference.
   * @param type    One of the NotificationType values
   * @param enabled true = receive this type; false = mute it
   */
  async setPreference(userId: string, type: string, enabled: boolean) {
    if (!ALL_TYPES.includes(type as NType)) {
      const err = new Error(`Invalid notification type: ${type}`);
      (err as { status?: number }).status = 422;
      throw err;
    }
    return prisma.notificationPreference.upsert({
      where: { userId_type: { userId, type: type as NType } },
      update: { enabled },
      create: { userId, type: type as NType, enabled }
    });
  }

  /**
   * Bulk-updates all notification preferences at once.
   * @param prefs  Array of { type, enabled } objects
   */
  async setAllPreferences(userId: string, prefs: { type: string; enabled: boolean }[]) {
    const invalid = prefs.filter((p) => !ALL_TYPES.includes(p.type as NType));
    if (invalid.length) {
      const err = new Error(`Invalid types: ${invalid.map((p) => p.type).join(', ')}`);
      (err as { status?: number }).status = 422;
      throw err;
    }

    await prisma.$transaction(
      prefs.map(({ type, enabled }) =>
        prisma.notificationPreference.upsert({
          where: { userId_type: { userId, type: type as NType } },
          update: { enabled },
          create: { userId, type: type as NType, enabled }
        })
      )
    );

    return this.getPreferences(userId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal helper — used by other services (posts, comments, followers)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Creates a notification and emits it via Socket.IO, respecting user prefs.
   * Import and call this from posts/comments/followers services instead of
   * duplicating notification logic everywhere.
   */
  static async createAndEmit(input: {
    recipientId: string;
    actorId: string;
    type: NType;
    entityId: string;
    entityType: 'POST' | 'COMMENT' | 'MESSAGE' | 'USER' | 'FOLLOW';
  }) {
    // Honour preference
    const pref = await prisma.notificationPreference.findUnique({
      where: { userId_type: { userId: input.recipientId, type: input.type } }
    });
    if (pref && !pref.enabled) return null;

    const notification = await prisma.notification.create({
      data: {
        recipientId: input.recipientId,
        actorId: input.actorId,
        type: input.type,
        entityType: input.entityType,
        entityId: input.entityId
      },
      include: { actor: { select: publicUserSelect } }
    });

    const io = getSocketServer();
    io?.to(`user:${input.recipientId}`).emit('notification', notification);

    return notification;
  }
}
