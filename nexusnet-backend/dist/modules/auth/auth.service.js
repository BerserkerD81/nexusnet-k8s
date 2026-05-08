"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const speakeasy_1 = __importDefault(require("speakeasy"));
const qrcode_1 = __importDefault(require("qrcode"));
const sanitize_html_1 = __importDefault(require("sanitize-html"));
const prisma_1 = require("../../config/prisma");
const redis_1 = require("../../config/redis");
const env_1 = require("../../config/env");
const crypto_1 = require("../../utils/crypto");
const shared_1 = require("../shared");
const authToken_1 = require("../../services/authToken");
class AuthService {
    /** Registers a new user and creates an initial session. */
    async register(input, ipAddress, deviceInfo) {
        const passwordHash = await (0, crypto_1.hashPassword)(input.password);
        const user = await (0, prisma_1.prismaQuery)(() => prisma_1.prisma.user.create({
            data: {
                email: input.email.toLowerCase(),
                username: input.username.toLowerCase(),
                displayName: (0, sanitize_html_1.default)(input.displayName, {
                    allowedTags: [],
                    allowedAttributes: {}
                }),
                passwordHash
            },
            select: shared_1.publicUserSelect
        }));
        return this.createSessionTokens(user, ipAddress, deviceInfo);
    }
    /** Authenticates credentials and returns tokens or MFA challenge. */
    async login(input, ipAddress, deviceInfo) {
        const user = await prisma_1.prisma.user.findFirst({
            where: {
                OR: [
                    { email: input.identifier.toLowerCase() },
                    { username: input.identifier.toLowerCase() }
                ],
                deletedAt: null
            }
        });
        if (!user) {
            throw new Error('Invalid credentials');
        }
        // OAuth-only accounts have no local password.
        // Reject password login with a clear (but not enumeration-friendly) error.
        if (!user.passwordHash) {
            throw new Error('This account uses social login. Please sign in with your provider (Google/GitHub).');
        }
        const valid = await (0, crypto_1.verifyPassword)(input.password, user.passwordHash);
        if (!valid) {
            throw new Error('Invalid credentials');
        }
        if (user.mfaEnabled) {
            return this.buildMfaChallenge(user);
        }
        return this.createSessionTokens(user, ipAddress, deviceInfo);
    }
    /** Starts MFA enrollment and returns a provisioning URI and QR code data URL. */
    async enableMfa(userId) {
        const secret = speakeasy_1.default.generateSecret({
            name: `${env_1.env.MFA_ISSUER} (${userId})`
        });
        if (!secret.base32 || !secret.otpauth_url) {
            throw new Error('Unable to generate MFA secret');
        }
        await prisma_1.prisma.user.update({
            where: { id: userId },
            data: { mfaSecret: secret.base32 }
        });
        const qrCodeDataUrl = await qrcode_1.default.toDataURL(secret.otpauth_url);
        return {
            secret: secret.base32,
            qrCodeDataUrl,
            provisioningUri: secret.otpauth_url
        };
    }
    /** Confirms the MFA token and enables MFA on the user account. */
    async verifyMfa(userId, token) {
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user?.mfaSecret) {
            throw new Error('MFA secret missing');
        }
        const verified = speakeasy_1.default.totp.verify({
            secret: user.mfaSecret,
            encoding: 'base32',
            token,
            window: 1
        });
        if (!verified) {
            throw new Error('Invalid MFA token');
        }
        await prisma_1.prisma.user.update({
            where: { id: userId },
            data: { mfaEnabled: true }
        });
        await prisma_1.prisma.auditLog.create({ data: { userId, action: 'mfa_enabled' } });
        return { enabled: true };
    }
    /** Validates MFA during login and issues tokens. */
    async validateMfa(userId, token, ipAddress, deviceInfo) {
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user?.mfaSecret) {
            throw new Error('MFA secret missing');
        }
        const verified = speakeasy_1.default.totp.verify({
            secret: user.mfaSecret,
            encoding: 'base32',
            token,
            window: 1
        });
        if (!verified) {
            throw new Error('Invalid MFA token');
        }
        return this.createSessionTokens(user, ipAddress, deviceInfo);
    }
    /** Rotates the refresh token and returns a new access token. */
    async refresh(refreshToken) {
        const session = await prisma_1.prisma.session.findUnique({
            where: { refreshToken },
            include: { user: true }
        });
        if (!session || session.revokedAt || session.expiresAt < new Date()) {
            throw new Error('Refresh token is invalid');
        }
        await (0, redis_1.redisCall)(async () => redis_1.redis.del(`refresh:${refreshToken}`));
        await prisma_1.prisma.session.update({
            where: { id: session.id },
            data: { revokedAt: new Date() }
        });
        const payload = {
            sub: session.user.id,
            email: session.user.email,
            username: session.user.username,
            displayName: session.user.displayName,
            mfaEnabled: session.user.mfaEnabled
        };
        const newAccessToken = (0, authToken_1.signAccessToken)(payload);
        const newRefreshToken = (0, authToken_1.signRefreshToken)(payload);
        await prisma_1.prisma.session.create({
            data: {
                userId: session.user.id,
                refreshToken: newRefreshToken,
                deviceInfo: session.deviceInfo,
                ipAddress: session.ipAddress,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
        });
        await redis_1.redis.set(`refresh:${newRefreshToken}`, session.user.id, 'EX', 7 * 24 * 60 * 60);
        return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    }
    /** Revokes the current session and clears Redis state. */
    async logout(userId, refreshToken) {
        const session = refreshToken
            ? await prisma_1.prisma.session.findUnique({ where: { refreshToken } })
            : await prisma_1.prisma.session.findFirst({
                where: { userId, revokedAt: null },
                orderBy: { createdAt: 'desc' }
            });
        if (!session) {
            return;
        }
        await prisma_1.prisma.session.update({
            where: { id: session.id },
            data: { revokedAt: new Date() }
        });
        await redis_1.redis.del(`refresh:${session.refreshToken}`);
        await prisma_1.prisma.auditLog.create({ data: { userId, action: 'logout' } });
    }
    /** Lists all active sessions for a user. */
    async listSessions(userId) {
        return prisma_1.prisma.session.findMany({
            where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: 'desc' }
        });
    }
    /** Revokes a single session by id. */
    async revokeSession(userId, sessionId) {
        const session = await prisma_1.prisma.session.findFirst({
            where: { id: sessionId, userId }
        });
        if (!session) {
            throw new Error('Session not found');
        }
        await prisma_1.prisma.session.update({
            where: { id: sessionId },
            data: { revokedAt: new Date() }
        });
        await redis_1.redis.del(`refresh:${session.refreshToken}`);
    }
    buildMfaChallenge(user) {
        return {
            accessToken: '',
            refreshToken: '',
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                displayName: user.displayName,
                mfaEnabled: true
            },
            mfaRequired: true
        };
    }
    async createSessionTokens(user, ipAddress, deviceInfo) {
        const payload = {
            sub: user.id,
            email: user.email,
            username: user.username,
            displayName: user.displayName,
            mfaEnabled: user.mfaEnabled
        };
        const accessToken = (0, authToken_1.signAccessToken)(payload);
        const refreshToken = (0, authToken_1.signRefreshToken)(payload);
        await prisma_1.prisma.session.create({
            data: {
                userId: user.id,
                refreshToken,
                deviceInfo,
                ipAddress,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
        });
        await redis_1.redis.set(`refresh:${refreshToken}`, user.id, 'EX', 7 * 24 * 60 * 60);
        await prisma_1.prisma.auditLog.create({
            data: { userId: user.id, action: 'login', ipAddress }
        });
        return {
            accessToken,
            refreshToken,
            user,
            mfaRequired: false
        };
    }
}
exports.AuthService = AuthService;
