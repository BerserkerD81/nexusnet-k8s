"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagesService = void 0;
const sanitize_html_1 = __importDefault(require("sanitize-html"));
const prisma_1 = require("../../config/prisma");
const pagination_1 = require("../../utils/pagination");
const shared_1 = require("../shared");
const io_1 = require("../../sockets/io");
const e2e_1 = require("../../utils/e2e");
class MessagesService {
    // ─────────────────────────────────────────────────────────────────────────
    // Conversations
    // ─────────────────────────────────────────────────────────────────────────
    /** Lists the user's conversations with unread counts and last message. */
    async listConversations(userId) {
        return prisma_1.prisma.conversationParticipant.findMany({
            where: { userId },
            include: {
                conversation: {
                    include: {
                        participants: { include: { user: { select: shared_1.publicUserSelect } } },
                        messages: { orderBy: { createdAt: 'desc' }, take: 1 }
                    }
                }
            },
            orderBy: { joinedAt: 'desc' }
        });
    }
    /** Creates or fetches a direct message conversation between two users. */
    async getOrCreateDm(userId, otherUserId) {
        const existing = await prisma_1.prisma.conversation.findFirst({
            where: {
                isGroup: false,
                participants: { every: { userId: { in: [userId, otherUserId] } } }
            },
            include: { participants: true }
        });
        if (existing)
            return existing;
        return prisma_1.prisma.conversation.create({
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
    async upsertPublicKey(userId, conversationId, publicKey) {
        await this.assertParticipant(conversationId, userId);
        if (!(0, e2e_1.isValidPublicKey)(publicKey)) {
            const err = new Error('Invalid public key: must be a 32-byte X25519 point (base64)');
            err.status = 422;
            throw err;
        }
        await prisma_1.prisma.userPublicKey.upsert({
            where: { userId_conversationId: { userId, conversationId } },
            update: { publicKey },
            create: { userId, conversationId, publicKey }
        });
    }
    /**
     * Returns all participants public keys for a conversation so the client
     * can derive a shared secret for each recipient.
     */
    async getConversationKeys(conversationId, userId) {
        await this.assertParticipant(conversationId, userId);
        const keys = await prisma_1.prisma.userPublicKey.findMany({
            where: { conversationId },
            include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } }
        });
        return keys.map((k) => ({ userId: k.userId, publicKey: k.publicKey, user: k.user }));
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Sending Messages
    // ─────────────────────────────────────────────────────────────────────────
    /** Sends a plaintext message (legacy / unencrypted). */
    async sendMessage(conversationId, senderId, input) {
        await this.assertParticipant(conversationId, senderId);
        const content = (0, sanitize_html_1.default)(input.content, { allowedTags: [], allowedAttributes: {} });
        const message = await prisma_1.prisma.message.create({
            data: { conversationId, senderId, content, mediaUrl: input.mediaUrl, messageType: input.messageType, isEncrypted: false }
        });
        await this.emitAndNotify(conversationId, senderId, message);
        return message;
    }
    /**
     * Sends an E2E-encrypted message.
     * The server stores only the encrypted payload; it never sees plaintext.
     */
    async sendEncryptedMessage(conversationId, senderId, payload, mediaUrl, messageType = 'TEXT') {
        await this.assertParticipant(conversationId, senderId);
        const message = await prisma_1.prisma.message.create({
            data: {
                conversationId,
                senderId,
                content: null,
                encryptedPayload: (0, e2e_1.serializePayload)(payload),
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
    async listMessages(conversationId, userId, cursor, limitInput) {
        await this.assertParticipant(conversationId, userId);
        const limit = (0, pagination_1.parseLimit)(limitInput, 30, 100);
        const messages = await prisma_1.prisma.message.findMany({
            where: { conversationId, deletedAt: null },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            orderBy: { createdAt: 'desc' }
        });
        const hasMore = messages.length > limit;
        const pageItems = hasMore ? messages.slice(0, limit) : messages;
        const enriched = pageItems.map((m) => ({
            ...m,
            encryptedPayload: m.encryptedPayload ? (0, e2e_1.deserializePayload)(m.encryptedPayload) : null
        }));
        return { items: enriched, pagination: { nextCursor: pageItems.at(-1)?.id ?? null, hasMore } };
    }
    /** Marks all messages in a conversation as read and notifies the sender. */
    async markRead(conversationId, userId) {
        await this.assertParticipant(conversationId, userId);
        await prisma_1.prisma.message.updateMany({
            where: { conversationId, isRead: false, senderId: { not: userId } },
            data: { isRead: true, readAt: new Date() }
        });
        await prisma_1.prisma.conversationParticipant.updateMany({
            where: { conversationId, userId },
            data: { lastReadAt: new Date() }
        });
        const io = (0, io_1.getSocketServer)();
        io?.to(`conversation:${conversationId}`).emit('messages_read', { conversationId, readBy: userId });
    }
    /** Soft deletes a message and notifies conversation participants. */
    async softDelete(messageId, userId) {
        const message = await prisma_1.prisma.message.findFirst({ where: { id: messageId, senderId: userId, deletedAt: null } });
        if (!message)
            throw new Error('Message not found');
        await prisma_1.prisma.message.update({ where: { id: messageId }, data: { deletedAt: new Date() } });
        const io = (0, io_1.getSocketServer)();
        io?.to(`conversation:${message.conversationId}`).emit('message_deleted', {
            messageId,
            conversationId: message.conversationId
        });
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────
    async emitAndNotify(conversationId, senderId, message) {
        const io = (0, io_1.getSocketServer)();
        io?.to(`conversation:${conversationId}`).emit('new_message', { conversationId, message });
        const participants = await prisma_1.prisma.conversationParticipant.findMany({
            where: { conversationId, userId: { not: senderId } },
            select: { userId: true }
        });
        await Promise.all(participants.map(async ({ userId }) => {
            const pref = await prisma_1.prisma.notificationPreference.findUnique({
                where: { userId_type: { userId, type: 'MESSAGE' } }
            });
            if (pref && !pref.enabled)
                return;
            const notification = await prisma_1.prisma.notification.create({
                data: { recipientId: userId, actorId: senderId, type: 'MESSAGE', entityType: 'MESSAGE', entityId: message.id },
                include: { actor: { select: shared_1.publicUserSelect } }
            });
            io?.to(`user:${userId}`).emit('notification', notification);
        }));
    }
    async assertParticipant(conversationId, userId) {
        const participant = await prisma_1.prisma.conversationParticipant.findFirst({ where: { conversationId, userId } });
        if (!participant) {
            const error = new Error('Conversation not found');
            error.status = 404;
            throw error;
        }
    }
}
exports.MessagesService = MessagesService;
