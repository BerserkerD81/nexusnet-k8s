"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketServer = setupSocketServer;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const redis_1 = require("../config/redis");
const metrics_1 = require("../config/metrics");
const env_1 = require("../config/env");
function setupSocketServer(io) {
    io.use(async (socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) {
            next(new Error('Unauthorized'));
            return;
        }
        try {
            const payload = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
            socket.data.userId = payload.sub;
            next();
        }
        catch {
            next(new Error('Unauthorized'));
        }
    });
    io.on('connection', (socket) => {
        metrics_1.websocketConnections.inc();
        const userId = socket.data.userId;
        if (userId) {
            // Store presence in Redis with per-socket membership and 5-minute expiration.
            void redis_1.redis.sadd(`presence:${userId}`, socket.id);
            void redis_1.redis.expire(`presence:${userId}`, 300);
            socket.join(`user:${userId}`);
            // ✅ Join broadcast rooms for feed updates (used across all replicas)
            socket.join('feed');
            socket.join('explore');
            socket.join('global-notifications');
            // Increment active users metric
            const count = (io.engine.clientsCount ?? 0);
            metrics_1.activeUsers.set(count);
        }
        // User joins a conversation - notify others in that conversation that this user is online
        socket.on('join_conversation', (conversationId) => {
            if (!conversationId || !userId)
                return;
            socket.join(`conversation:${conversationId}`);
            // Notify all users in this conversation that this user is now online
            socket.to(`conversation:${conversationId}`).emit('user_online_in_conversation', {
                userId,
                conversationId,
                timestamp: new Date().toISOString()
            });
        });
        // User leaves a conversation - notify others that this user is offline from this conversation
        socket.on('leave_conversation', (conversationId) => {
            if (!conversationId || !userId)
                return;
            socket.leave(`conversation:${conversationId}`);
            // Notify all users in this conversation that this user is offline
            socket.to(`conversation:${conversationId}`).emit('user_offline_in_conversation', {
                userId,
                conversationId,
                timestamp: new Date().toISOString()
            });
        });
        socket.on('typing_start', (conversationId) => {
            if (!conversationId || !userId)
                return;
            socket.to(`conversation:${conversationId}`).emit('typing_start', { userId, conversationId });
        });
        socket.on('typing_stop', (conversationId) => {
            if (!conversationId || !userId)
                return;
            socket.to(`conversation:${conversationId}`).emit('typing_stop', { userId, conversationId });
        });
        // ✅ IMPROVED: Send message with full message object
        socket.on('send_message', ({ conversationId, message }) => {
            if (!conversationId || !message || !userId)
                return;
            io.to(`conversation:${conversationId}`).emit('new_message_sent', {
                conversationId,
                message,
                userId,
                timestamp: new Date().toISOString()
            });
        });
        // ✅ NEW: Broadcast when conversation list needs refresh
        socket.on('refresh_conversations', () => {
            if (!userId)
                return;
            io.to(`user:${userId}`).emit('conversations_updated', { userId });
        });
        // ✅ NEW: Broadcast when feed needs refresh
        socket.on('refresh_feed', () => {
            if (!userId)
                return;
            io.emit('feed_updated', { timestamp: new Date().toISOString() });
        });
        socket.on('disconnect', async () => {
            metrics_1.websocketConnections.dec();
            if (userId) {
                await redis_1.redis.srem(`presence:${userId}`, socket.id);
                const remaining = await redis_1.redis.scard(`presence:${userId}`);
                if (remaining === 0) {
                    await redis_1.redis.del(`presence:${userId}`);
                }
                // Update active users metric
                const count = Math.max((io.engine.clientsCount ?? 0) - 1, 0);
                metrics_1.activeUsers.set(count);
            }
        });
    });
}
