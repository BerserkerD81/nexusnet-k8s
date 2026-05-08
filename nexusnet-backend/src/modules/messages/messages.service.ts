import sanitizeHtml from 'sanitize-html';
import { prisma } from '@config/prisma';
import { parseLimit } from '@utils/pagination';
import { publicUserSelect } from '@modules/shared';
import { getSocketServer } from '@sockets/io';
import { isValidPublicKey, serializePayload, deserializePayload, type EncryptedPayload } from '@utils/e2e';

export class MessagesService {
  // ─────────────────────────────────────────────────────────────────────────
  // Conversations
  // ─────────────────────────────────────────────────────────────────────────

  /** Lists the user's conversations with unread counts and last message. */
  async listConversations(userId: string) {
    return prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: { include: { user: { select: publicUserSelect } } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 }
          }
        }
      },
      orderBy: { joinedAt: 'desc' }
    });
  }

  /** Creates or fetches a direct message conversation between two users. */
  async getOrCreateDm(userId: string, otherUserId: string) {
    const existing = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        participants: { every: { userId: { in: [userId, otherUserId] } } }
      },
      include: { participants: true }
    });

    if (existing) return existing;

    return prisma.conversation.create({
      data: {
        isGroup: false,
        participants: { create: [{ userId }, { userId: otherUserId }] }
      },
      include: { participants: true }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // E2E Public Key Exchange
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Stores or replaces the caller's X25519 public key for a conversation.
   * Called by the client after it generates a new ephemeral key-pair.
   */
  async upsertPublicKey(userId: string, conversationId: string, publicKey: string): Promise<void> {
    await this.assertParticipant(conversationId, userId);

    if (!isValidPublicKey(publicKey)) {
      const err = new Error('Invalid public key: must be a 32-byte X25519 point (base64)');
      (err as { status?: number }).status = 422;
      throw err;
    }

    await prisma.userPublicKey.upsert({
      where: { userId_conversationId: { userId, conversationId } },
      update: { publicKey },
      create: { userId, conversationId, publicKey }
    });
  }

  /**
   * Returns all participants public keys for a conversation so the client
   * can derive a shared secret for each recipient.
   */
  async getConversationKeys(conversationId: string, userId: string) {
    await this.assertParticipant(conversationId, userId);

    const keys = await prisma.userPublicKey.findMany({
      where: { conversationId },
      include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } }
    });

    return keys.map((k) => ({ userId: k.userId, publicKey: k.publicKey, user: k.user }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Sending Messages
  // ─────────────────────────────────────────────────────────────────────────

  /** Sends a plaintext message (legacy / unencrypted). */
  async sendMessage(
    conversationId: string,
    senderId: string,
    input: { content: string; mediaUrl?: string; messageType: 'TEXT' | 'IMAGE' | 'VIDEO' }
  ) {
    await this.assertParticipant(conversationId, senderId);
    const content = sanitizeHtml(input.content, { allowedTags: [], allowedAttributes: {} });

    const message = await prisma.message.create({
      data: { conversationId, senderId, content, mediaUrl: input.mediaUrl, messageType: input.messageType, isEncrypted: false }
    });

    await this.emitAndNotify(conversationId, senderId, message);
    return message;
  }

  /**
   * Sends an E2E-encrypted message.
   * The server stores only the encrypted payload; it never sees plaintext.
   */
  async sendEncryptedMessage(
    conversationId: string,
    senderId: string,
    payload: EncryptedPayload,
    mediaUrl?: string,
    messageType: 'TEXT' | 'IMAGE' | 'VIDEO' = 'TEXT'
  ) {
    await this.assertParticipant(conversationId, senderId);

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId,
        content: null,
        encryptedPayload: serializePayload(payload),
        mediaUrl,
        messageType,
        isEncrypted: true
      }
    });

    await this.emitAndNotify(conversationId, senderId, message);
    return message;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Reading Messages
  // ─────────────────────────────────────────────────────────────────────────

  /** Returns paginated message history. Encrypted messages include parsed payload. */
  async listMessages(conversationId: string, userId: string, cursor?: string, limitInput?: string) {
    await this.assertParticipant(conversationId, userId);
    const limit = parseLimit(limitInput, 30, 100);

    const messages = await prisma.message.findMany({
      where: { conversationId, deletedAt: null },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' }
    });

    const hasMore = messages.length > limit;
    const pageItems = hasMore ? messages.slice(0, limit) : messages;

    const enriched = pageItems.map((m) => ({
      ...m,
      encryptedPayload: m.encryptedPayload ? deserializePayload(m.encryptedPayload) : null
    }));

    return { items: enriched, pagination: { nextCursor: pageItems.at(-1)?.id ?? null, hasMore } };
  }

  /** Marks all messages in a conversation as read and notifies the sender. */
  async markRead(conversationId: string, userId: string): Promise<void> {
    await this.assertParticipant(conversationId, userId);
    await prisma.message.updateMany({
      where: { conversationId, isRead: false, senderId: { not: userId } },
      data: { isRead: true, readAt: new Date() }
    });
    await prisma.conversationParticipant.updateMany({
      where: { conversationId, userId },
      data: { lastReadAt: new Date() }
    });

    const io = getSocketServer();
    io?.to(`conversation:${conversationId}`).emit('messages_read', { conversationId, readBy: userId });
  }

  /** Soft deletes a message and notifies conversation participants. */
  async softDelete(messageId: string, userId: string): Promise<void> {
    const message = await prisma.message.findFirst({ where: { id: messageId, senderId: userId, deletedAt: null } });
    if (!message) throw new Error('Message not found');
    await prisma.message.update({ where: { id: messageId }, data: { deletedAt: new Date() } });

    const io = getSocketServer();
    io?.to(`conversation:${message.conversationId}`).emit('message_deleted', {
      messageId,
      conversationId: message.conversationId
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async emitAndNotify(conversationId: string, senderId: string, message: { id: string }) {
    const io = getSocketServer();
    io?.to(`conversation:${conversationId}`).emit('new_message', { conversationId, message });

    const participants = await prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: senderId } },
      select: { userId: true }
    });

    await Promise.all(
      participants.map(async ({ userId }) => {
        const pref = await prisma.notificationPreference.findUnique({
          where: { userId_type: { userId, type: 'MESSAGE' } }
        });
        if (pref && !pref.enabled) return;

        const notification = await prisma.notification.create({
          data: { recipientId: userId, actorId: senderId, type: 'MESSAGE', entityType: 'MESSAGE', entityId: message.id },
          include: { actor: { select: publicUserSelect } }
        });

        io?.to(`user:${userId}`).emit('notification', notification);
      })
    );
  }

  private async assertParticipant(conversationId: string, userId: string): Promise<void> {
    const participant = await prisma.conversationParticipant.findFirst({ where: { conversationId, userId } });
    if (!participant) {
      const error = new Error('Conversation not found');
      (error as { status?: number }).status = 404;
      throw error;
    }
  }
}
