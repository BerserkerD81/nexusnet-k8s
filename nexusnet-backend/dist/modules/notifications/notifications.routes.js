"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsRouter = void 0;
const express_1 = require("express");
const authGuard_1 = require("../../middlewares/authGuard");
const notifications_service_1 = require("./notifications.service");
const router = (0, express_1.Router)();
exports.notificationsRouter = router;
const svc = new notifications_service_1.NotificationsService();
// ── Listing ──────────────────────────────────────────────────────────────────
router.get('/', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const { cursor, limit, type } = req.query;
        res.json(await svc.list(req.user.id, cursor, limit, type));
    }
    catch (e) {
        next(e);
    }
});
router.get('/unread-count', authGuard_1.authGuard, async (req, res, next) => {
    try {
        res.json(await svc.unreadCount(req.user.id));
    }
    catch (e) {
        next(e);
    }
});
// ── Preferences (must be before /:id routes to avoid param conflicts) ─────────
router.get('/preferences', authGuard_1.authGuard, async (req, res, next) => {
    try {
        res.json(await svc.getPreferences(req.user.id));
    }
    catch (e) {
        next(e);
    }
});
router.patch('/preferences/:type', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const { enabled } = req.body;
        if (typeof enabled !== 'boolean') {
            res.status(400).json({ error: 'enabled (boolean) is required' });
            return;
        }
        res.json(await svc.setPreference(req.user.id, String(req.params.type), enabled));
    }
    catch (e) {
        next(e);
    }
});
router.put('/preferences', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const { preferences } = req.body;
        if (!Array.isArray(preferences)) {
            res.status(400).json({ error: 'preferences array is required' });
            return;
        }
        res.json(await svc.setAllPreferences(req.user.id, preferences));
    }
    catch (e) {
        next(e);
    }
});
// ── Read / Delete ─────────────────────────────────────────────────────────────
router.post('/read-all', authGuard_1.authGuard, async (req, res, next) => {
    try {
        await svc.markAllRead(req.user.id);
        res.status(204).end();
    }
    catch (e) {
        next(e);
    }
});
router.delete('/read', authGuard_1.authGuard, async (req, res, next) => {
    try {
        await svc.deleteAllRead(req.user.id);
        res.status(204).end();
    }
    catch (e) {
        next(e);
    }
});
router.post('/:id/read', authGuard_1.authGuard, async (req, res, next) => {
    try {
        await svc.markOneRead(req.user.id, String(req.params.id));
        res.status(204).end();
    }
    catch (e) {
        next(e);
    }
});
router.delete('/:id', authGuard_1.authGuard, async (req, res, next) => {
    try {
        await svc.deleteOne(req.user.id, String(req.params.id));
        res.status(204).end();
    }
    catch (e) {
        next(e);
    }
});
