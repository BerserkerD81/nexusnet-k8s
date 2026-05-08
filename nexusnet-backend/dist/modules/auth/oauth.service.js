"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthService = void 0;
const prisma_1 = require("../../config/prisma");
const redis_1 = require("../../config/redis");
const authToken_1 = require("../../services/authToken");
const shared_1 = require("../shared");
class OAuthService {
    /**
     * Finds or creates a user for the given OAuth profile, then links the
     * OAuthAccount record and returns a fresh JWT pair — exactly the same
     * shape that the existing `/login` endpoint returns.
     */
    async handleOAuthLogin(input, ipAddress, deviceInfo) {
        // 1. Try to find an existing linked OAuth account.
        const existingOAuth = await prisma_1.prisma.oAuthAccount.findUnique({
            where: {
                provider_providerAccountId: {
                    provider: input.provider,
                    providerAccountId: input.providerAccountId
                }
            },
            include: { user: { select: shared_1.publicUserSelect } }
        });
        if (existingOAuth) {
            // Update stored tokens from the provider (they may have rotated).
            await prisma_1.prisma.oAuthAccount.update({
                where: { id: existingOAuth.id },
                data: {
                    accessToken: input.accessToken,
                    refreshToken: input.refreshToken ?? null,
                    expiresAt: input.expiresAt ?? null
                }
            });
            await prisma_1.prisma.auditLog.create({
                data: {
                    userId: existingOAuth.user.id,
                    action: 'oauth_login',
                    metadata: { provider: input.provider },
                    ipAddress
                }
            });
            return this.issueTokens(existingOAuth.user, ipAddress, deviceInfo);
        }
        // 2. No existing OAuth account — find or create the user.
        let user = input.email
            ? await prisma_1.prisma.user.findFirst({
                where: { email: input.email.toLowerCase(), deletedAt: null },
                select: shared_1.publicUserSelect
            })
            : null;
        if (!user) {
            // Generate a unique username based on the provider hint or displayName.
            const baseUsername = this.slugify(input.username ?? input.displayName);
            const username = await this.uniqueUsername(baseUsername);
            user = await (0, prisma_1.prismaQuery)(() => prisma_1.prisma.user.create({
                data: {
                    email: input.email
                        ? input.email.toLowerCase()
                        : `${username}@oauth.placeholder`,
                    username,
                    displayName: input.displayName,
                    avatarUrl: input.avatarUrl ?? null,
                    // passwordHash is null — OAuth users have no local password.
                    passwordHash: null
                },
                select: shared_1.publicUserSelect
            }));
        }
        // 3. Link the OAuth account to the user.
        await (0, prisma_1.prismaQuery)(() => prisma_1.prisma.oAuthAccount.create({
            data: {
                userId: user.id,
                provider: input.provider,
                providerAccountId: input.providerAccountId,
                accessToken: input.accessToken,
                refreshToken: input.refreshToken ?? null,
                expiresAt: input.expiresAt ?? null
            }
        }));
        await prisma_1.prisma.auditLog.create({
            data: {
                userId: user.id,
                action: 'oauth_login',
                metadata: { provider: input.provider, firstLogin: true },
                ipAddress
            }
        });
        return this.issueTokens(user, ipAddress, deviceInfo);
    }
    // ─── Private helpers ───────────────────────────────────────────────────────
    /**
     * Creates a session + JWT pair — mirrors AuthService.createSessionTokens
     * so both flows produce the exact same token shape.
     */
    async issueTokens(user, ipAddress, deviceInfo) {
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
        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                displayName: user.displayName,
                mfaEnabled: user.mfaEnabled
            },
            mfaRequired: false
        };
    }
    /** Converts a string to a lowercase alphanumeric slug (no spaces/specials). */
    slugify(name) {
        return (name
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .slice(0, 25) || 'user');
    }
    /** Appends a numeric suffix until the username is unique in the DB. */
    async uniqueUsername(base) {
        let candidate = base;
        let attempt = 0;
        // Hard cap to avoid infinite loops in pathological cases.
        while (attempt < 1000) {
            const existing = await prisma_1.prisma.user.findUnique({
                where: { username: candidate }
            });
            if (!existing)
                return candidate;
            attempt++;
            candidate = `${base}_${attempt}`;
        }
        throw new Error('Unable to generate a unique username');
    }
}
exports.OAuthService = OAuthService;
