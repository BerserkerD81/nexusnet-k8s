import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { env } from '@config/env';

// Skip rate limiting para health checks y dev
const skip = (req: Request) => {
  return req.path.includes('/health') || 
         req.path.includes('/ready') ||
         req.path.includes('/metrics') ||
         req.path.includes('/docs') ||
         env.NODE_ENV === 'development';
};

// Auth limiter: 60 requests por 15 minutos (permite recarga sin problemas)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: 'Demasiadas solicitudes de autenticación, intenta más tarde',
  handler: (_req, res) => {
    res.status(429).json({ 
      error: 'Demasiadas solicitudes. Intenta más tarde.' 
    });
  }
});

// Post limiter: 100 posts por hora
export const postRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: 'Has alcanzado el límite de posts'
});

// Message limiter: 300 mensajes por minuto
export const messageRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: 'Has alcanzado el límite de mensajes'
});

// Global limiter: 10000 requests por 15 minutos (muy generoso)
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: 10000,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: 'Demasiadas solicitudes, intenta más tarde',
});
