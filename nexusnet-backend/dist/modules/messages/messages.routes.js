"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messagesRouter = void 0;
const express_1 = require("express");
const authGuard_1 = require("../../middlewares/authGuard");
const http_1 = require("../../utils/http");
const messages_service_1 = require("./messages.service");
const router = (0, express_1.Router)();
exports.messagesRouter = router;
const svc = new messages_service_1.MessagesService();
// GET  /api/v1/messages/conversations
router.get('/conversations', authGuard_1.authGuard, async (req, res, next) => {
    try {
        res.json((0, http_1.successResponse)(await svc.listConversations(req.user.id)));
    }
    catch (e) {
        next(e);
    }
});
// POST /api/v1/messages/conversations  { otherUserId }
router.post('/conversations', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const { otherUserId } = req.body;
        if (!otherUserId) {
            res.status(400).json({ error: 'otherUserId is required' });
            return;
        }
        res.status(201).json((0, http_1.successResponse)(await svc.getOrCreateDm(req.user.id, otherUserId), 'Conversation ready'));
    }
    catch (e) {
        next(e);
    }
});
// POST /api/v1/messages/conversations/:conversationId/keys
router.post('/conversations/:conversationId/keys', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const { publicKey } = req.body;
        if (!publicKey) {
            res.status(400).json({ error: 'publicKey is required' });
            return;
        }
        await svc.upsertPublicKey(req.user.id, String(req.params.conversationId), publicKey);
        res.status(204).end();
    }
    catch (e) {
        next(e);
    }
});
// GET  /api/v1/messages/conversations/:conversationId/keys
router.get('/conversations/:conversationId/keys', authGuard_1.authGuard, async (req, res, next) => {
    try {
        res.json((0, http_1.successResponse)(await svc.getConversationKeys(String(req.params.conversationId), req.user.id)));
    }
    catch (e) {
        next(e);
    }
});
// GET  /api/v1/messages/conversations/:conversationId/messages
router.get('/conversations/:conversationId/messages', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const { cursor, limit } = req.query;
        const result = await svc.listMessages(String(req.params.conversationId), req.user.id, cursor, limit);
        res.json((0, http_1.successResponse)(result.items, 'Messages loaded', result.pagination));
    }
    catch (e) {
        next(e);
    }
});
// POST /api/v1/messages/conversations/:conversationId/messages  (plaintext)
router.post('/conversations/:conversationId/messages', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const { content, mediaUrl, messageType } = req.body;
        if (!content) {
            res.status(400).json({ error: 'content is required' });
            return;
        }
        res.status(201).json((0, http_1.successResponse)(await svc.sendMessage(String(req.params.conversationId), req.user.id, {
            content, mediaUrl, messageType: messageType ?? 'TEXT'
        }), 'Message sent'));
    }
    catch (e) {
        next(e);
    }
});
// POST /api/v1/messages/conversations/:conversationId/messages/encrypted
router.post('/conversations/:conversationId/messages/encrypted', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const { iv, ciphertext, authTag, mediaUrl, messageType } = req.body;
        if (!iv || !ciphertext || !authTag) {
            res.status(400).json({ error: 'iv, ciphertext and authTag are required' });
            return;
        }
        res.status(201).json((0, http_1.successResponse)(await svc.sendEncryptedMessage(String(req.params.conversationId), req.user.id, { iv, ciphertext, authTag }, mediaUrl, messageType ?? 'TEXT'), 'Encrypted message sent'));
    }
    catch (e) {
        next(e);
    }
});
// PUT  /api/v1/messages/conversations/:conversationId/messages/read
router.put('/conversations/:conversationId/messages/read', authGuard_1.authGuard, async (req, res, next) => {
    try {
        await svc.markRead(String(req.params.conversationId), req.user.id);
        res.status(204).end();
    }
    catch (e) {
        next(e);
    }
});
// DELETE /api/v1/messages/:messageId
router.delete('/:messageId', authGuard_1.authGuard, async (req, res, next) => {
    try {
        await svc.softDelete(String(req.params.messageId), req.user.id);
        res.status(204).end();
    }
    catch (e) {
        next(e);
    }
});
