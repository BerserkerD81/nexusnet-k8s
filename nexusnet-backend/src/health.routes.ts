import type { Request, Response } from 'express';
import { prisma } from '@config/prisma';
import { redis } from '@config/redis';
import { promClient } from '@config/metrics';
import { successResponse, errorResponse } from '@utils/http';

export const healthRouter = {
  health(_req: Request, res: Response): void {
    res.status(200).json(successResponse({ status: 'ok' }, 'Healthy'));
  },
  async ready(_req: Request, res: Response): Promise<void> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      await redis.ping();
      res.status(200).json(successResponse({ status: 'ready' }, 'Ready'));
    } catch {
      res.status(503).json(errorResponse('Service not ready'));
    }
  },
  async metrics(_req: Request, res: Response): Promise<void> {
    res.setHeader('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
  }
};
