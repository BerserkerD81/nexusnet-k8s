"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const authGuard_1 = require("../../middlewares/authGuard");
const rateLimiters_1 = require("../../middlewares/rateLimiters");
const uploadMiddleware_1 = require("../../middlewares/uploadMiddleware");
const http_1 = require("../../utils/http");
const posts_service_1 = require("./posts.service");
const uploads_service_1 = require("../../services/uploads.service");
const router = (0, express_1.Router)();
exports.postsRouter = router;
const postsService = new posts_service_1.PostsService();
const createPostSchema = zod_1.z.object({
    content: zod_1.z.string().max(280).optional().default(''),
    mediaUrls: zod_1.z.array(zod_1.z.string().min(1)).optional().default([]),
    mood: zod_1.z.string().max(32).optional().nullable(),
    poll: zod_1.z.object({
        question: zod_1.z.string().min(1).max(280),
        options: zod_1.z.array(zod_1.z.string().min(1).max(80)).min(2).max(6)
    }).optional().nullable(),
    parentId: zod_1.z.string().optional().nullable(),
    idempotencyKey: zod_1.z.string().optional()
});
// ✅ NEW: Handle file uploads with multipart/form-data
router.post('/', authGuard_1.authGuard, rateLimiters_1.postRateLimiter, uploadMiddleware_1.uploadMiddleware.array('images', 4), async (req, res, next) => {
    try {
        // Validate and process uploaded images
        const files = Array.isArray(req.files) ? req.files : undefined;
        uploads_service_1.uploadsService.validateImages(files);
        const uploadedMediaUrls = files && files.length > 0
            ? await uploads_service_1.uploadsService.processImageFiles(files)
            : [];
        // Combine uploaded URLs with any provided URLs
        const providedUrls = req.body.mediaUrls ?
            (Array.isArray(req.body.mediaUrls) ? req.body.mediaUrls : [req.body.mediaUrls])
            : [];
        const allMediaUrls = [...uploadedMediaUrls, ...providedUrls].slice(0, 4);
        // Parse and validate request body
        const body = createPostSchema.parse({
            ...req.body,
            mediaUrls: allMediaUrls
        });
        const post = await postsService.createPost(req.user.id, body);
        res.status(201).json((0, http_1.successResponse)(post, 'Post created'));
    }
    catch (error) {
        next(error);
    }
});
router.get('/feed', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const feed = await postsService.feed(req.user.id, req.query.cursor, req.query.limit);
        res.json((0, http_1.successResponse)(feed.items, 'Feed loaded', feed.pagination));
    }
    catch (error) {
        next(error);
    }
});
// ✅ FIX: pass viewerId so explore enriches isLiked/isReposted for authenticated users
router.get('/explore', async (req, res, next) => {
    try {
        const feed = await postsService.explore(req.query.cursor, req.query.limit, req.user?.id);
        res.json((0, http_1.successResponse)(feed.items, 'Explore loaded', feed.pagination));
    }
    catch (error) {
        next(error);
    }
});
// ✅ FIX: pass viewerId so postsByUser enriches isLiked/isReposted
router.get('/user/:username', async (req, res, next) => {
    try {
        const posts = await postsService.postsByUser(req.params.username, req.query.cursor, req.query.limit, req.user?.id);
        res.json((0, http_1.successResponse)(posts.items, 'User posts loaded', posts.pagination));
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id', async (req, res, next) => {
    try {
        const post = await postsService.getById(req.params.id, req.user?.id);
        res.json((0, http_1.successResponse)(post, 'Post loaded'));
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:id', authGuard_1.authGuard, async (req, res, next) => {
    try {
        await postsService.softDelete(req.params.id, req.user.id);
        res.json((0, http_1.successResponse)(null, 'Post deleted'));
    }
    catch (error) {
        next(error);
    }
});
router.post('/:id/like', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const result = await postsService.toggleLike(req.params.id, req.user.id);
        res.json((0, http_1.successResponse)(result, 'Like toggled'));
    }
    catch (error) {
        next(error);
    }
});
router.post('/:id/repost', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const result = await postsService.toggleRepost(req.params.id, req.user.id);
        res.json((0, http_1.successResponse)(result, 'Repost toggled'));
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id/likes', async (req, res, next) => {
    try {
        const likes = await postsService.listLikes(req.params.id, req.query.cursor, req.query.limit);
        res.json((0, http_1.successResponse)(likes.items, 'Likes loaded', likes.pagination));
    }
    catch (error) {
        next(error);
    }
});
