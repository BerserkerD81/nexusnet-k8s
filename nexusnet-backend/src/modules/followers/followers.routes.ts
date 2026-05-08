import { Router } from 'express';
import { authGuard } from '@middlewares/authGuard';
import { successResponse } from '@utils/http';
import { FollowersService } from './followers.service';

const router = Router();
const followersService = new FollowersService();

router.get('/suggestions', authGuard, async (req, res, next) => {
  try {
    const suggestions = await followersService.suggestions(req.user!.id);
    res.json(successResponse(suggestions, 'Suggestions loaded'));
  } catch (error) {
    next(error);
  }
});

router.post('/:userId', authGuard, async (req, res, next) => {
  try {
    const result = await followersService.follow(req.user!.id, req.params.userId as string);
    res.json(successResponse(result, 'Follow request processed'));
  } catch (error) {
    next(error);
  }
});

router.delete('/:userId', authGuard, async (req, res, next) => {
  try {
    await followersService.unfollow(req.user!.id, req.params.userId as string);
    res.json(successResponse(null, 'Unfollowed'));
  } catch (error) {
    next(error);
  }
});

router.post('/requests/:userId', authGuard, async (req, res, next) => {
  try {
    const accepted = Boolean(req.body.accepted ?? true);
    const result = await followersService.respondToRequest(req.user!.id, req.params.userId as string, accepted);
    res.json(successResponse(result, accepted ? 'Follow request accepted' : 'Follow request rejected'));
  } catch (error) {
    next(error);
  }
});

router.get('/requests', authGuard, async (req, res, next) => {
  try {
    const result = await followersService.listRequests(req.user!.id, req.query.cursor as string | undefined, req.query.limit as string | undefined);
    res.json(successResponse(result.items, 'Follow requests loaded', result.pagination));
  } catch (error) {
    next(error);
  }
});

router.delete('/followers/:userId', authGuard, async (req, res, next) => {
  try {
    await followersService.removeFollower(req.user!.id, req.params.userId as string);
    res.json(successResponse(null, 'Follower removed'));
  } catch (error) {
    next(error);
  }
});

router.get('/:userId/followers', async (req, res, next) => {
  try {
    const result = await followersService.listFollowers(req.params.userId, req.query.cursor as string | undefined, req.query.limit as string | undefined);
    res.json(successResponse(result.items, 'Followers loaded', result.pagination));
  } catch (error) {
    next(error);
  }
});

router.get('/:userId/following', async (req, res, next) => {
  try {
    const result = await followersService.listFollowing(req.params.userId, req.query.cursor as string | undefined, req.query.limit as string | undefined);
    res.json(successResponse(result.items, 'Following loaded', result.pagination));
  } catch (error) {
    next(error);
  }
});

export { router as followersRouter };
