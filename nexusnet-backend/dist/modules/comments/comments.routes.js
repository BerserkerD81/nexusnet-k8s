"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const authGuard_1 = require("../../middlewares/authGuard");
const http_1 = require("../../utils/http");
const comments_service_1 = require("./comments.service");
const router = (0, express_1.Router)();
exports.commentsRouter = router;
const commentsService = new comments_service_1.CommentsService();
router.post('/:postId', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const body = zod_1.z.object({ content: zod_1.z.string().min(1).max(500) }).parse(req.body);
        const comment = await commentsService.add(req.params.postId, req.user.id, body.content);
        res.status(201).json((0, http_1.successResponse)(comment, 'Comment created'));
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:commentId', authGuard_1.authGuard, async (req, res, next) => {
    try {
        await commentsService.softDelete(req.params.commentId, req.user.id);
        res.json((0, http_1.successResponse)(null, 'Comment deleted'));
    }
    catch (error) {
        next(error);
    }
});
router.post('/:commentId/like', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const result = await commentsService.toggleLike(req.params.commentId, req.user.id);
        res.json((0, http_1.successResponse)(result, 'Comment like toggled'));
    }
    catch (error) {
        next(error);
    }
});
