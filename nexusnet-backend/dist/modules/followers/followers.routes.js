"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.followersRouter = void 0;
const express_1 = require("express");
const authGuard_1 = require("../../middlewares/authGuard");
const http_1 = require("../../utils/http");
const followers_service_1 = require("./followers.service");
const router = (0, express_1.Router)();
exports.followersRouter = router;
const followersService = new followers_service_1.FollowersService();
router.get('/suggestions', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const suggestions = await followersService.suggestions(req.user.id);
        res.json((0, http_1.successResponse)(suggestions, 'Suggestions loaded'));
    }
    catch (error) {
        next(error);
    }
});
router.post('/:userId', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const result = await followersService.follow(req.user.id, req.params.userId);
        res.json((0, http_1.successResponse)(result, 'Follow request processed'));
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:userId', authGuard_1.authGuard, async (req, res, next) => {
    try {
        await followersService.unfollow(req.user.id, req.params.userId);
        res.json((0, http_1.successResponse)(null, 'Unfollowed'));
    }
    catch (error) {
        next(error);
    }
});
router.post('/requests/:userId', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const accepted = Boolean(req.body.accepted ?? true);
        const result = await followersService.respondToRequest(req.user.id, req.params.userId, accepted);
        res.json((0, http_1.successResponse)(result, accepted ? 'Follow request accepted' : 'Follow request rejected'));
    }
    catch (error) {
        next(error);
    }
});
router.get('/:userId/followers', async (req, res, next) => {
    try {
        const result = await followersService.listFollowers(req.params.userId, req.query.cursor, req.query.limit);
        res.json((0, http_1.successResponse)(result.items, 'Followers loaded', result.pagination));
    }
    catch (error) {
        next(error);
    }
});
router.get('/:userId/following', async (req, res, next) => {
    try {
        const result = await followersService.listFollowing(req.params.userId, req.query.cursor, req.query.limit);
        res.json((0, http_1.successResponse)(result.items, 'Following loaded', result.pagination));
    }
    catch (error) {
        next(error);
    }
});
