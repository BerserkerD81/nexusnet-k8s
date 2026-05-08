import { Router } from 'express';
import { z } from 'zod';
import { authGuard } from '@middlewares/authGuard';
import { successResponse } from '@utils/http';
import { CommentsService } from './comments.service';

const router = Router();
const commentsService = new CommentsService();

router.post('/:postId', authGuard, async (req, res, next) => {
  try {
    const body = z.object({ content: z.string().min(1).max(500) }).parse(req.body);
    const comment = await commentsService.add(req.params.postId as string, req.user!.id, body.content);
    res.status(201).json(successResponse(comment, 'Comment created'));
  } catch (error) {
    next(error);
  }
});

router.delete('/:commentId', authGuard, async (req, res, next) => {
  try {
    await commentsService.softDelete(req.params.commentId as string, req.user!.id);
    res.json(successResponse(null, 'Comment deleted'));
  } catch (error) {
    next(error);
  }
});

router.post('/:commentId/like', authGuard, async (req, res, next) => {
  try {
    const result = await commentsService.toggleLike(req.params.commentId as string, req.user!.id);
    res.json(successResponse(result, 'Comment like toggled'));
  } catch (error) {
    next(error);
  }
});

export { router as commentsRouter };
