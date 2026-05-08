import type { NextFunction, Request, Response } from 'express';
import { errorResponse } from '@utils/http';
import { logger } from '@config/logger';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(errorResponse(`Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const message = error instanceof Error ? error.message : 'Internal server error';
  const status = typeof (error as { status?: number }).status === 'number'
    ? (error as { status: number }).status
    : 500;
  logger.error({ error }, 'Unhandled error');
  res.status(status).json(errorResponse(message));
}
