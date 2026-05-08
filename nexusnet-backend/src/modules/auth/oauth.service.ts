import type { OAuthProvider } from '@prisma/client';
import { prisma, prismaQuery } from '@config/prisma';
import { redis } from '@config/redis';
import { signAccessToken, signRefreshToken } from '@services/authToken';
import { publicUserSelect } from '@modules/shared';
import type { AuthTokens } from './auth.service';

export type OAuthLoginInput = {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string | null;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
};

type SessionUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  mfaEnabled: boolean;
};

export class OAuthService {
  /**
   * Finds or creates a user for the given OAuth profile, then links the
   * OAuthAccount record and returns a fresh JWT pair — exactly the same
   * shape that the existing `/login` endpoint returns.
   */
  async handleOAuthLogin(
    input: OAuthLoginInput,
    ipAddress?: string,
    deviceInfo?: string
  ): Promise<AuthTokens> {
    // 1. Try to find an existing linked OAuth account.
    const existingOAuth = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: input.provider,
          providerAccountId: input.providerAccountId
        }
      },
      include: { user: { select: publicUserSelect } }
    });

    if (existingOAuth) {
      // Update stored tokens from the provider (they may have rotated).
      await prisma.oAuthAccount.update({
        where: { id: existingOAuth.id },
        data: {
          accessToken: input.accessToken,
          refreshToken: input.refreshToken ?? null,
          expiresAt: input.expiresAt ?? null
        }
      });

      await prisma.auditLog.create({
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
    let user: SessionUser | null = input.email
      ? await prisma.user.findFirst({
          where: { email: input.email.toLowerCase(), deletedAt: null },
          select: publicUserSelect
        })
      : null;

    if (!user) {
      // Generate a unique username based on the provider hint or displayName.
      const baseUsername = this.slugify(input.username ?? input.displayName);
      const username = await this.uniqueUsername(baseUsername);

      user = await prismaQuery(() =>
        prisma.user.create({
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
          select: publicUserSelect
        })
      );
    }

    // 3. Link the OAuth account to the user.
    await prismaQuery(() =>
      prisma.oAuthAccount.create({
        data: {
          userId: user!.id,
          provider: input.provider,
          providerAccountId: input.providerAccountId,
          accessToken: input.accessToken,
          refreshToken: input.refreshToken ?? null,
          expiresAt: input.expiresAt ?? null
        }
      })
    );

    await prisma.auditLog.create({
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
  private async issueTokens(
    user: SessionUser,
    ipAddress?: string,
    deviceInfo?: string
  ): Promise<AuthTokens> {
    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      mfaEnabled: user.mfaEnabled
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        deviceInfo,
        ipAddress,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    await redis.set(`refresh:${refreshToken}`, user.id, 'EX', 7 * 24 * 60 * 60);

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
  private slugify(name: string): string {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 25) || 'user'
    );
  }

  /** Appends a numeric suffix until the username is unique in the DB. */
  private async uniqueUsername(base: string): Promise<string> {
    let candidate = base;
    let attempt = 0;

    // Hard cap to avoid infinite loops in pathological cases.
    while (attempt < 1000) {
      const existing = await prisma.user.findUnique({
        where: { username: candidate }
      });
      if (!existing) return candidate;
      attempt++;
      candidate = `${base}_${attempt}`;
    }

    throw new Error('Unable to generate a unique username');
  }
}