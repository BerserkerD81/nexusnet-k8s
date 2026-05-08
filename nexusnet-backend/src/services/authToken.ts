import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '@config/env';
import type { JwtPayload } from '@middlewares/authGuard';

export function signAccessToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as any };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function signRefreshToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: '7d' };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
}
