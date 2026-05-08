import { Router, type Request, type Response, type NextFunction } from 'express';
import { passport } from '@config/passport';
import { env } from '@config/env';
import { successResponse } from '@utils/http';
import type { AuthTokens, AuthUser } from './auth.service';

const router = Router();

// ─── Shared callback handler ─────────────────────────────────────────────────

/**
 * After Passport authenticates the user:
 *  - req.user     → AuthUser  (set as the 2nd arg of done() in the strategy)
 *  - req.authInfo → { accessToken, refreshToken } (3rd arg of done())
 *
 * Response strategy:
 *  - API clients  → JSON  (when Accept: application/json)
 *  - Browser flow → redirect to FRONTEND_URL with tokens in the query string
 *                   so the SPA can store them.
 *
 * In production prefer an httpOnly cookie or a short-lived one-time code
 * over query params.
 */
function handleOAuthCallback(req: Request, res: Response) {
  const user = req.user as AuthUser;
  const authInfo = req.authInfo as {
    accessToken: string;
    refreshToken: string;
  };

  if (!authInfo?.accessToken || !authInfo?.refreshToken) {
    return res.status(500).json({
      success: false,
      data: null,
      message: 'OAuth callback did not receive tokens'
    });
  }

  const acceptsJson =
    req.headers.accept?.includes('application/json') ||
    req.headers['x-requested-with'] === 'XMLHttpRequest';

  if (acceptsJson) {
    return res.json(
      successResponse(
        { user, ...authInfo } as AuthTokens,
        'OAuth login successful'
      )
    );
  }

  // Browser redirect → al FRONTEND con los tokens en la query string.
  const redirectUrl = new URL('/auth/callback', env.FRONTEND_URL);
  redirectUrl.searchParams.set('accessToken', authInfo.accessToken);
  redirectUrl.searchParams.set('refreshToken', authInfo.refreshToken);
  return res.redirect(redirectUrl.toString());
}

function oauthErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  res.status(401).json({
    success: false,
    data: null,
    message: err.message || 'OAuth authentication failed'
  });
}

// ─── GitHub ──────────────────────────────────────────────────────────────────

router.get(
  '/github',
  passport.authenticate('github', {
    session: false,
    scope: ['user:email']
  })
);

router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failWithError: true }),
  handleOAuthCallback,
  oauthErrorHandler
);

// ─── Google ──────────────────────────────────────────────────────────────────

router.get(
  '/google',
  passport.authenticate('google', {
    session: false,
    scope: ['profile', 'email']
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failWithError: true }),
  handleOAuthCallback,
  oauthErrorHandler
);

export { router as oauthRouter };