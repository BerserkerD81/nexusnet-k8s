import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { authRateLimiter, globalRateLimiter } from '@middlewares/rateLimiters';
import { notFoundHandler, errorHandler } from '@middlewares/errorHandler';
import { buildSwaggerSpec } from './docs/swagger';
import { authRouter } from '@modules/auth/auth.routes';
import { oauthRouter } from '@modules/auth/oauth.routes';
import { passport } from '@config/passport';
import { usersRouter } from '@modules/users/users.routes';
import { postsRouter } from '@modules/posts/posts.routes';
import { commentsRouter } from '@modules/comments/comments.routes';
import { followersRouter } from '@modules/followers/followers.routes';
import { messagesRouter } from '@modules/messages/messages.routes';
import { notificationsRouter } from '@modules/notifications/notifications.routes';
import { healthRouter } from './health.routes';

export function createApp() {
  const app = express();
  const swaggerSpec = buildSwaggerSpec();

  app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'connect-src': ["'self'", 'https:', 'wss:']
      }
    }
  }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(globalRateLimiter);

  // Passport — stateless (session: false), no session middleware needed.
  app.use(passport.initialize());

  app.get('/health', healthRouter.health);
  app.get('/ready', healthRouter.ready);
  app.get('/metrics', healthRouter.metrics);
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use('/api/v1/auth', authRateLimiter, authRouter);
  app.use('/api/v1/auth/oauth', oauthRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/posts', postsRouter);
  app.use('/api/v1/comments', commentsRouter);
  app.use('/api/v1/follow', followersRouter);
  app.use('/api/v1/messages', messagesRouter);
  app.use('/api/v1/notifications', notificationsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
