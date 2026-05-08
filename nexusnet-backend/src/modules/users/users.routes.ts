import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authGuard } from '@middlewares/authGuard';
import { uploadMiddleware } from '@middlewares/uploadMiddleware';
import { successResponse } from '@utils/http';
import { uploadsService } from '@services/uploads.service';
import { UsersService } from './users.service';

const router = Router();
const usersService = new UsersService();

router.get('/me', authGuard, async (req, res, next) => {
  try {
    const profile = await usersService.getMe(req.user!.id);
    res.json(successResponse(profile, 'Profile loaded'));
  } catch (error) {
    next(error);
  }
});

router.put('/me', authGuard, uploadMiddleware.single('avatar'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      displayName: z.string().min(1).max(100).optional(),
      bio: z.string().max(500).nullable().optional(),
      avatarUrl: z.string().url().nullable().optional(),
      bannerUrl: z.string().url().nullable().optional(),
      username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/).optional(),
      isPrivate: z.preprocess((value) => {
        if (typeof value === 'string') {
          return value === 'true';
        }
        return value;
      }, z.boolean().optional())
    }).parse(req.body);

    // Process avatar file if provided
    let avatarUrl = body.avatarUrl;
    if ((req.files as Express.Multer.File[] | undefined)?.length) {
      const uploadedUrls = await uploadsService.processImageFiles(req.files as Express.Multer.File[]);
      avatarUrl = uploadedUrls[0] ?? avatarUrl;
    }

    const profile = await usersService.updateMe(req.user!.id, { ...body, avatarUrl });
    res.json(successResponse(profile, 'Profile updated'));
  } catch (error) {
    next(error);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const q = z.string().min(1).parse(req.query.q);
    const users = await usersService.search(q, req.query.cursor as string | undefined, req.query.limit as string | undefined);
    res.json(successResponse(users.items, 'Users found', users.pagination));
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/users/:userId/online - Check if user is online
router.get('/:userId/online', authGuard, async (req, res, next) => {
  try {
    const onlineStatus = await usersService.isUserOnline(req.params.userId as string);
    res.json(successResponse(onlineStatus, 'Online status retrieved'));
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/users/batch/online - Check multiple users' online status
router.post('/batch/online', authGuard, async (req, res, next) => {
  try {
    const body = z.object({
      userIds: z.array(z.string()).min(1).max(50)
    }).parse(req.body);
    const statuses = await usersService.checkUsersOnline(body.userIds);
    res.json(successResponse(statuses, 'Online statuses retrieved'));
  } catch (error) {
    next(error);
  }
});

router.get('/:username', authGuard, async (req, res, next) => {
  try {
    const profile = await usersService.getByUsername(req.params.username as string, req.user?.id);
    res.json(successResponse(profile, 'Public profile loaded'));
  } catch (error) {
    next(error);
  }
});

export { router as usersRouter };
