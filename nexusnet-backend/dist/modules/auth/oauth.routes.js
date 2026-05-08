"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oauthRouter = void 0;
const express_1 = require("express");
const passport_1 = require("../../config/passport");
const env_1 = require("../../config/env");
const http_1 = require("../../utils/http");
const router = (0, express_1.Router)();
exports.oauthRouter = router;
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
function handleOAuthCallback(req, res) {
    const user = req.user;
    const authInfo = req.authInfo;
    if (!authInfo?.accessToken || !authInfo?.refreshToken) {
        return res.status(500).json({
            success: false,
            data: null,
            message: 'OAuth callback did not receive tokens'
        });
    }
    const acceptsJson = req.headers.accept?.includes('application/json') ||
        req.headers['x-requested-with'] === 'XMLHttpRequest';
    if (acceptsJson) {
        return res.json((0, http_1.successResponse)({ user, ...authInfo }, 'OAuth login successful'));
    }
    // Browser redirect → al FRONTEND con los tokens en la query string.
    const redirectUrl = new URL('/auth/callback', env_1.env.FRONTEND_URL);
    redirectUrl.searchParams.set('accessToken', authInfo.accessToken);
    redirectUrl.searchParams.set('refreshToken', authInfo.refreshToken);
    return res.redirect(redirectUrl.toString());
}
function oauthErrorHandler(err, _req, res, _next) {
    res.status(401).json({
        success: false,
        data: null,
        message: err.message || 'OAuth authentication failed'
    });
}
// ─── GitHub ──────────────────────────────────────────────────────────────────
router.get('/github', passport_1.passport.authenticate('github', {
    session: false,
    scope: ['user:email']
}));
router.get('/github/callback', passport_1.passport.authenticate('github', { session: false, failWithError: true }), handleOAuthCallback, oauthErrorHandler);
// ─── Google ──────────────────────────────────────────────────────────────────
router.get('/google', passport_1.passport.authenticate('google', {
    session: false,
    scope: ['profile', 'email']
}));
router.get('/google/callback', passport_1.passport.authenticate('google', { session: false, failWithError: true }), handleOAuthCallback, oauthErrorHandler);
