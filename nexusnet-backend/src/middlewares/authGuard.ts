import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@config/env';

export type JwtPayload = {
  sub: string;
  email: string;
  username: string;
  displayName: string;
  mfaEnabled: boolean;
};

export function authGuard(req: Request, res: Response, next: NextFunction): void {
  const authorization = req.header('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, data: null, message: 'Unauthorized' });
    return;
  }

  try {
    const token = authorization.slice(7);
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = {
      id: payload.sub,
      email: payload.email,
      username: payload.username,
      displayName: payload.displayName,
      mfaEnabled: payload.mfaEnabled
    };
    next();
  } catch {
    res.status(401).json({ success: false, data: null, message: 'Invalid or expired token' });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authorization = req.header('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    const token = authorization.slice(7);
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = {
      id: payload.sub,
      email: payload.email,
      username: payload.username,
      displayName: payload.displayName,
      mfaEnabled: payload.mfaEnabled
    };
  } catch {
    // Ignore invalid token; continue unauthenticated.
  }
  next();
}
