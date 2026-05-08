import type { Session, User } from '@prisma/client';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import sanitizeHtml from 'sanitize-html';
import { prisma, prismaQuery } from '@config/prisma';
import { redisCall, redis } from '@config/redis';
import { env } from '@config/env';
import { hashPassword, verifyPassword } from '@utils/crypto';
import { publicUserSelect } from '@modules/shared';
import { signAccessToken, signRefreshToken } from '@services/authToken';

export type RegisterInput = {
  email: string;
  username: string;
  password: string;
  displayName: string;
};

export type LoginInput = {
  identifier: string;
  password: string;
};
export type AuthUser = Pick<
  User,
  'id' | 'email' | 'username' | 'displayName' | 'mfaEnabled'
>;
export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  user: Pick<User, 'id' | 'email' | 'username' | 'displayName' | 'mfaEnabled'>;
  mfaRequired: boolean;
};

export class AuthService {
  /** Registers a new user and creates an initial session. */
  async register(
    input: RegisterInput,
    ipAddress?: string,
    deviceInfo?: string
  ): Promise<AuthTokens> {
    const passwordHash = await hashPassword(input.password);
    const user = await prismaQuery(() =>
      prisma.user.create({
        data: {
          email: input.email.toLowerCase(),
          username: input.username.toLowerCase(),
          displayName: sanitizeHtml(input.displayName, {
            allowedTags: [],
            allowedAttributes: {}
          }),
          passwordHash
        },
        select: publicUserSelect
      })
    );

    return this.createSessionTokens(user, ipAddress, deviceInfo);
  }

  /** Authenticates credentials and returns tokens or MFA challenge. */
  async login(
    input: LoginInput,
    ipAddress?: string,
    deviceInfo?: string
  ): Promise<AuthTokens> {
    const user = await prisma.user.findFirst({
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
      throw new Error(
        'This account uses social login. Please sign in with your provider (Google/GitHub).'
      );
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw new Error('Invalid credentials');
    }

    if (user.mfaEnabled) {
      return this.buildMfaChallenge(user);
    }

    return this.createSessionTokens(user, ipAddress, deviceInfo);
  }

  /** Starts MFA enrollment and returns a provisioning URI and QR code data URL. */
  async enableMfa(
    userId: string
  ): Promise<{ secret: string; qrCodeDataUrl: string; provisioningUri: string }> {
    const secret = speakeasy.generateSecret({
      name: `${env.MFA_ISSUER} (${userId})`
    });
    if (!secret.base32 || !secret.otpauth_url) {
      throw new Error('Unable to generate MFA secret');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret.base32 }
    });
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCodeDataUrl,
      provisioningUri: secret.otpauth_url
    };
  }

  /** Confirms the MFA token and enables MFA on the user account. */
  async verifyMfa(userId: string, token: string): Promise<{ enabled: boolean }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) {
      throw new Error('MFA secret missing');
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!verified) {
      throw new Error('Invalid MFA token');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true }
    });
    await prisma.auditLog.create({ data: { userId, action: 'mfa_enabled' } });

    return { enabled: true };
  }

  /** Validates MFA during login and issues tokens. */
  async validateMfa(
    userId: string,
    token: string,
    ipAddress?: string,
    deviceInfo?: string
  ): Promise<AuthTokens> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) {
      throw new Error('MFA secret missing');
    }

    const verified = speakeasy.totp.verify({
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
  async refresh(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const session = await prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true }
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new Error('Refresh token is invalid');
    }

    await redisCall(async () => redis.del(`refresh:${refreshToken}`));
    await prisma.session.update({
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

    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken(payload);

    await prisma.session.create({
      data: {
        userId: session.user.id,
        refreshToken: newRefreshToken,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    await redis.set(
      `refresh:${newRefreshToken}`,
      session.user.id,
      'EX',
      7 * 24 * 60 * 60
    );

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  /** Revokes the current session and clears Redis state. */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    const session = refreshToken
      ? await prisma.session.findUnique({ where: { refreshToken } })
      : await prisma.session.findFirst({
          where: { userId, revokedAt: null },
          orderBy: { createdAt: 'desc' }
        });

    if (!session) {
      return;
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() }
    });
    await redis.del(`refresh:${session.refreshToken}`);
    await prisma.auditLog.create({ data: { userId, action: 'logout' } });
  }

  /** Lists all active sessions for a user. */
  async listSessions(userId: string): Promise<Session[]> {
    return prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' }
    });
  }

  /** Revokes a single session by id. */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId }
    });
    if (!session) {
      throw new Error('Session not found');
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() }
    });
    await redis.del(`refresh:${session.refreshToken}`);
  }

  private buildMfaChallenge(user: User): AuthTokens {
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

  private async createSessionTokens(
    user: Pick<User, 'id' | 'email' | 'username' | 'displayName' | 'mfaEnabled'>,
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
    await prisma.auditLog.create({
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