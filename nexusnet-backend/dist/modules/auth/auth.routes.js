"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const authGuard_1 = require("../../middlewares/authGuard");
const mfaCheck_1 = require("../../middlewares/mfaCheck");
const http_1 = require("../../utils/http");
const auth_service_1 = require("./auth.service");
const router = (0, express_1.Router)();
exports.authRouter = router;
const authService = new auth_service_1.AuthService();
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    username: zod_1.z.string().min(3).max(30),
    password: zod_1.z.string().min(8).max(128),
    displayName: zod_1.z.string().min(1).max(100)
});
const loginSchema = zod_1.z.object({
    identifier: zod_1.z.string().min(3),
    password: zod_1.z.string().min(8)
});
const mfaTokenSchema = zod_1.z.object({ token: zod_1.z.string().min(6).max(8) });
router.post('/register', async (req, res, next) => {
    try {
        const body = registerSchema.parse(req.body);
        const result = await authService.register(body, req.ip ?? undefined, req.get('user-agent') ?? undefined);
        res.status(201).json((0, http_1.successResponse)(result, 'User registered'));
    }
    catch (error) {
        next(error);
    }
});
router.post('/login', async (req, res, next) => {
    try {
        const body = loginSchema.parse(req.body);
        const result = await authService.login(body, req.ip ?? undefined, req.get('user-agent') ?? undefined);
        res.json((0, http_1.successResponse)(result, 'Login successful'));
    }
    catch (error) {
        next(error);
    }
});
router.post('/mfa/enable', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const result = await authService.enableMfa(req.user.id);
        res.json((0, http_1.successResponse)(result, 'MFA secret generated'));
    }
    catch (error) {
        next(error);
    }
});
router.post('/mfa/verify', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const body = mfaTokenSchema.parse(req.body);
        const result = await authService.verifyMfa(req.user.id, body.token);
        res.json((0, http_1.successResponse)(result, 'MFA enabled'));
    }
    catch (error) {
        next(error);
    }
});
router.post('/mfa/validate', async (req, res, next) => {
    try {
        const body = zod_1.z.object({ userId: zod_1.z.string(), token: zod_1.z.string().min(6).max(8) }).parse(req.body);
        const result = await authService.validateMfa(body.userId, body.token, req.ip ?? undefined, req.get('user-agent') ?? undefined);
        res.json((0, http_1.successResponse)(result, 'MFA validated'));
    }
    catch (error) {
        next(error);
    }
});
router.post('/refresh', async (req, res, next) => {
    try {
        const body = zod_1.z.object({ refreshToken: zod_1.z.string().min(20) }).parse(req.body);
        const result = await authService.refresh(body.refreshToken);
        res.json((0, http_1.successResponse)(result, 'Token refreshed'));
    }
    catch (error) {
        next(error);
    }
});
router.post('/logout', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const body = zod_1.z.object({ refreshToken: zod_1.z.string().min(20).optional() }).parse(req.body);
        await authService.logout(req.user.id, body.refreshToken);
        res.json((0, http_1.successResponse)(null, 'Logged out'));
    }
    catch (error) {
        next(error);
    }
});
router.get('/sessions', authGuard_1.authGuard, async (req, res, next) => {
    try {
        const sessions = await authService.listSessions(req.user.id);
        res.json((0, http_1.successResponse)(sessions, 'Active sessions'));
    }
    catch (error) {
        next(error);
    }
});
router.delete('/sessions/:id', authGuard_1.authGuard, async (req, res, next) => {
    try {
        await authService.revokeSession(req.user.id, req.params.id);
        res.json((0, http_1.successResponse)(null, 'Session revoked'));
    }
    catch (error) {
        next(error);
    }
});
router.get('/me', authGuard_1.authGuard, mfaCheck_1.mfaRequired, async (req, res) => {
    res.json((0, http_1.successResponse)(req.user, 'Authenticated user'));
});
