import { Router } from 'express';
import { z } from 'zod';
import { authGuard } from '@middlewares/authGuard';
import { mfaRequired } from '@middlewares/mfaCheck';
import { successResponse } from '@utils/http';
import { AuthService } from './auth.service';

const router = Router();
const authService = new AuthService();

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100)
});

const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(8)
});

const mfaTokenSchema = z.object({ token: z.string().min(6).max(8) });

router.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const result = await authService.register(body, req.ip ?? undefined, req.get('user-agent') ?? undefined);
    res.status(201).json(successResponse(result, 'User registered'));
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await authService.login(body, req.ip ?? undefined, req.get('user-agent') ?? undefined);
    res.json(successResponse(result, 'Login successful'));
  } catch (error) {
    next(error);
  }
});

router.post('/mfa/enable', authGuard, async (req, res, next) => {
  try {
    const result = await authService.enableMfa(req.user!.id);
    res.json(successResponse(result, 'MFA secret generated'));
  } catch (error) {
    next(error);
  }
});

router.post('/mfa/verify', authGuard, async (req, res, next) => {
  try {
    const body = mfaTokenSchema.parse(req.body);
    const result = await authService.verifyMfa(req.user!.id, body.token);
    res.json(successResponse(result, 'MFA enabled'));
  } catch (error) {
    next(error);
  }
});

router.post('/mfa/validate', async (req, res, next) => {
  try {
    const body = z.object({ userId: z.string(), token: z.string().min(6).max(8) }).parse(req.body);
    const result = await authService.validateMfa(body.userId, body.token, req.ip ?? undefined, req.get('user-agent') ?? undefined);
    res.json(successResponse(result, 'MFA validated'));
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const body = z.object({ refreshToken: z.string().min(20) }).parse(req.body);
    const result = await authService.refresh(body.refreshToken);
    res.json(successResponse(result, 'Token refreshed'));
  } catch (error) {
    next(error);
  }
});

router.post('/logout', authGuard, async (req, res, next) => {
  try {
    const body = z.object({ refreshToken: z.string().min(20).optional() }).parse(req.body);
    await authService.logout(req.user!.id, body.refreshToken);
    res.json(successResponse(null, 'Logged out'));
  } catch (error) {
    next(error);
  }
});

router.get('/sessions', authGuard, async (req, res, next) => {
  try {
    const sessions = await authService.listSessions(req.user!.id);
    res.json(successResponse(sessions, 'Active sessions'));
  } catch (error) {
    next(error);
  }
});

router.delete('/sessions/:id', authGuard, async (req, res, next) => {
  try {
    await authService.revokeSession(req.user!.id, req.params.id as string);
    res.json(successResponse(null, 'Session revoked'));
  } catch (error) {
    next(error);
  }
});

router.get('/me', authGuard, mfaRequired, async (req, res) => {
  res.json(successResponse(req.user, 'Authenticated user'));
});

export { router as authRouter };
