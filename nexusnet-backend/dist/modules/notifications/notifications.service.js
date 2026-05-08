"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const prisma_1 = require("../../config/prisma");
const pagination_1 = require("../../utils/pagination");
const shared_1 = require("../shared");
const io_1 = require("../../sockets/io");
// All supported notification types (mirrors NotificationType enum)
const ALL_TYPES = ['FOLLOW', 'LIKE', 'REPOST', 'COMMENT', 'MENTION', 'MESSAGE', 'REPLY', 'COMMENT_LIKE'];
class NotificationsService {
    // ─────────────────────────────────────────────────────────────────────────
    // Listing
    // ─────────────────────────────────────────────────────────────────────────
    /** Returns the user's notifications with cursor pagination and optional type filtering. */
    async list(userId, cursor, limitInput, type) {
        const limit = (0, pagination_1.parseLimit)(limitInput, 20, 50);
        const notifications = await prisma_1.prisma.notification.findMany({
            where: {
                recipientId: userId,
                ...(type ? { type: type } : {})
            },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            orderBy: { createdAt: 'desc' },
            include: { actor: { select: shared_1.publicUserSelect } }
        });
        const hasMore = notifications.length > limit;
        const pageItems = hasMore ? notifications.slice(0, limit) : notifications;
        return { items: pageItems, pagination: { nextCursor: pageItems.at(-1)?.id ?? null, hasMore } };
    }
    /** Returns the unread notification count (used for badge display). */
    async unreadCount(userId) {
        const count = await prisma_1.prisma.notification.count({ where: { recipientId: userId, isRead: false } });
        return { count };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Read / Delete
    // ─────────────────────────────────────────────────────────────────────────
    /** Marks all notifications as read. */
    async markAllRead(userId) {
        await prisma_1.prisma.notification.updateMany({ where: { recipientId: userId, isRead: false }, data: { isRead: true } });
    }
    /** Marks a single notification as read. */
    async markOneRead(userId, notificationId) {
        const notification = await prisma_1.prisma.notification.findFirst({ where: { id: notificationId, recipientId: userId } });
        if (!notification)
            throw new Error('Notification not found');
        await prisma_1.prisma.notification.update({ where: { id: notificationId }, data: { isRead: true } });
    }
    /** Deletes a single notification for the user. */
    async deleteOne(userId, notificationId) {
        const notification = await prisma_1.prisma.notification.findFirst({ where: { id: notificationId, recipientId: userId } });
        if (!notification)
            throw new Error('Notification not found');
        await prisma_1.prisma.notification.delete({ where: { id: notificationId } });
    }
    /** Deletes all read notifications for the user. */
    async deleteAllRead(userId) {
        await prisma_1.prisma.notification.deleteMany({ where: { recipientId: userId, isRead: true } });
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Preferences
    // ─────────────────────────────────────────────────────────────────────────
    /** Returns the user's notification preferences for all types. */
    async getPreferences(userId) {
        const stored = await prisma_1.prisma.notificationPreference.findMany({ where: { userId } });
        const storedMap = new Map(stored.map((p) => [p.type, p.enabled]));
        // Return a full list — types with no DB row default to enabled: true
        return ALL_TYPES.map((type) => ({
            type,
            enabled: storedMap.has(type) ? storedMap.get(type) : true
        }));
    }
    /**
     * Upserts a single notification preference.
     * @param type    One of the NotificationType values
     * @param enabled true = receive this type; false = mute it
     */
    async setPreference(userId, type, enabled) {
        if (!ALL_TYPES.includes(type)) {
            const err = new Error(`Invalid notification type: ${type}`);
            err.status = 422;
            throw err;
        }
        return prisma_1.prisma.notificationPreference.upsert({
            where: { userId_type: { userId, type: type } },
            update: { enabled },
            create: { userId, type: type, enabled }
        });
    }
    /**
     * Bulk-updates all notification preferences at once.
     * @param prefs  Array of { type, enabled } objects
     */
    async setAllPreferences(userId, prefs) {
        const invalid = prefs.filter((p) => !ALL_TYPES.includes(p.type));
        if (invalid.length) {
            const err = new Error(`Invalid types: ${invalid.map((p) => p.type).join(', ')}`);
            err.status = 422;
            throw err;
        }
        await prisma_1.prisma.$transaction(prefs.map(({ type, enabled }) => prisma_1.prisma.notificationPreference.upsert({
            where: { userId_type: { userId, type: type } },
            update: { enabled },
            create: { userId, type: type, enabled }
        })));
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
    static async createAndEmit(input) {
        // Honour preference
        const pref = await prisma_1.prisma.notificationPreference.findUnique({
            where: { userId_type: { userId: input.recipientId, type: input.type } }
        });
        if (pref && !pref.enabled)
            return null;
        const notification = await prisma_1.prisma.notification.create({
            data: {
                recipientId: input.recipientId,
                actorId: input.actorId,
                type: input.type,
                entityType: input.entityType,
                entityId: input.entityId
            },
            include: { actor: { select: shared_1.publicUserSelect } }
        });
        const io = (0, io_1.getSocketServer)();
        io?.to(`user:${input.recipientId}`).emit('notification', notification);
        return notification;
    }
}
exports.NotificationsService = NotificationsService;
