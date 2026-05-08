"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const authGuard_1 = require("../../middlewares/authGuard");
const http_1 = require("../../utils/http");
const users_service_1 = require("./users.service");
const router = (0, express_1.Router)();
exports.usersRouter = router;
const usersService = new users_service_1.UsersService();
router.get('/me', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const profile = await usersService.getMe(req.user.id);
        res.json((0, http_1.successResponse)(profile, 'Profile loaded'));
    }
    catch (error) {
        next(error);
    }
});
router.put('/me', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const body = zod_1.z.object({
            displayName: zod_1.z.string().min(1).max(100).optional(),
            bio: zod_1.z.string().max(500).nullable().optional(),
            avatarUrl: zod_1.z.string().url().nullable().optional(),
            bannerUrl: zod_1.z.string().url().nullable().optional(),
            isPrivate: zod_1.z.boolean().optional()
        }).parse(req.body);
        const profile = await usersService.updateMe(req.user.id, body);
        res.json((0, http_1.successResponse)(profile, 'Profile updated'));
    }
    catch (error) {
        next(error);
    }
});
router.get('/search', async (req, res, next) => {
    try {
        const q = zod_1.z.string().min(1).parse(req.query.q);
        const users = await usersService.search(q, req.query.cursor, req.query.limit);
        res.json((0, http_1.successResponse)(users.items, 'Users found', users.pagination));
    }
    catch (error) {
        next(error);
    }
});
// GET /api/v1/users/:userId/online - Check if user is online
router.get('/:userId/online', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const onlineStatus = await usersService.isUserOnline(req.params.userId);
        res.json((0, http_1.successResponse)(onlineStatus, 'Online status retrieved'));
    }
    catch (error) {
        next(error);
    }
});
// POST /api/v1/users/batch/online - Check multiple users' online status
router.post('/batch/online', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const body = zod_1.z.object({
            userIds: zod_1.z.array(zod_1.z.string()).min(1).max(50)
        }).parse(req.body);
        const statuses = await usersService.checkUsersOnline(body.userIds);
        res.json((0, http_1.successResponse)(statuses, 'Online statuses retrieved'));
    }
    catch (error) {
        next(error);
    }
});
router.get('/:username', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const profile = await usersService.getByUsername(req.params.username, req.user?.id);
        res.json((0, http_1.successResponse)(profile, 'Public profile loaded'));
    }
    catch (error) {
        next(error);
    }
});
