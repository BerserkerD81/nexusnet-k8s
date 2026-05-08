import { Router } from 'express';
import { z } from 'zod';
import { authGuard, optionalAuth } from '@middlewares/authGuard';
import { postRateLimiter } from '@middlewares/rateLimiters';
import { uploadMiddleware } from '@middlewares/uploadMiddleware';
import { successResponse } from '@utils/http';
import { PostsService } from './posts.service';
import { uploadsService } from '@services/uploads.service';

const router = Router();
const postsService = new PostsService();

// ✅ FIX: accept unknown to handle all ParsedQs variants from req.query
function getQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
  if (typeof value === 'string') return value;
  return undefined;
}

// ✅ FIX: @types/express v5 changed ParamsDictionary to string | string[]
function getParamValue(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

const createPostSchema = z.object({
  content: z.string().max(280).optional().default(''),
  mediaUrls: z.array(z.string().min(1)).optional().default([]),
  mood: z.string().max(32).optional().nullable(),
  poll: z.object({
    question: z.string().min(1).max(280),
    options: z.array(z.string().min(1).max(80)).min(2).max(6)
  }).optional().nullable(),
  parentId: z.string().optional().nullable(),
  idempotencyKey: z.string().optional()
});

router.post('/', authGuard, postRateLimiter, uploadMiddleware.array('images', 4), async (req, res, next) => {
  try {
    const files = Array.isArray(req.files) ? req.files : undefined;
    uploadsService.validateImages(files as Express.Multer.File[] | undefined);
    const uploadedMediaUrls = files && files.length > 0
      ? await uploadsService.processImageFiles(files as Express.Multer.File[])
      : [];

    const providedUrls = req.body.mediaUrls ?
      (Array.isArray(req.body.mediaUrls) ? req.body.mediaUrls : [req.body.mediaUrls])
      : [];
    const allMediaUrls = [...uploadedMediaUrls, ...providedUrls].slice(0, 4);

    const body = createPostSchema.parse({
      ...req.body,
      mediaUrls: allMediaUrls
    });

    const post = await postsService.createPost(req.user!.id, body);
    res.status(201).json(successResponse(post, 'Post created'));
  } catch (error) {
    next(error);
  }
});

router.get('/feed', authGuard, async (req, res, next) => {
  try {
    const feed = await postsService.feed(
      req.user!.id,
      getQueryValue(req.query.cursor),
      getQueryValue(req.query.limit)
    );
    res.json(successResponse(feed.items, 'Feed loaded', feed.pagination));
  } catch (error) {
    next(error);
  }
});

router.get('/explore', optionalAuth, async (req, res, next) => {
  try {
    const feed = await postsService.explore(
      getQueryValue(req.query.cursor),
      getQueryValue(req.query.limit),
      req.user?.id
    );
    res.json(successResponse(feed.items, 'Explore loaded', feed.pagination));
  } catch (error) {
    next(error);
  }
});

router.get('/user/:username', optionalAuth, async (req, res, next) => {
  try {
    const posts = await postsService.postsByUser(
      getParamValue(req.params.username),
      getQueryValue(req.query.cursor),
      getQueryValue(req.query.limit),
      req.user?.id
    );
    res.json(successResponse(posts.items, 'User posts loaded', posts.pagination));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const post = await postsService.getById(getParamValue(req.params.id), req.user?.id);
    res.json(successResponse(post, 'Post loaded'));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authGuard, async (req, res, next) => {
  try {
    await postsService.softDelete(getParamValue(req.params.id), req.user!.id);
    res.json(successResponse(null, 'Post deleted'));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/like', authGuard, async (req, res, next) => {
  try {
    const result = await postsService.toggleLike(getParamValue(req.params.id), req.user!.id);
    res.json(successResponse(result, 'Like toggled'));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/repost', authGuard, async (req, res, next) => {
  try {
    const result = await postsService.toggleRepost(getParamValue(req.params.id), req.user!.id);
    res.json(successResponse(result, 'Repost toggled'));
  } catch (error) {
    next(error);
  }
});

router.get('/:id/likes', async (req, res, next) => {
  try {
    const likes = await postsService.listLikes(
      getParamValue(req.params.id),
      getQueryValue(req.query.cursor),
      getQueryValue(req.query.limit)
    );
    res.json(successResponse(likes.items, 'Likes loaded', likes.pagination));
  } catch (error) {
    next(error);
  }
});

export { router as postsRouter };