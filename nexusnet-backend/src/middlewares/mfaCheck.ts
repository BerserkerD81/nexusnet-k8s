import type { NextFunction, Request, Response } from 'express';

export function mfaRequired(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.mfaEnabled) {
    res.status(403).json({ success: false, data: null, message: 'MFA required' });
    return;
  }
  next();
}
