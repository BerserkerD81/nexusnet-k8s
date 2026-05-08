import http from 'node:http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createApp } from './app';
import { env } from '@config/env';
import { logger } from '@config/logger';
import { setupSocketServer } from '@sockets/index';
import { setSocketServer } from '@sockets/io';
import { prisma } from '@config/prisma';
import { redis } from '@config/redis';

async function bootstrap() {
  await prisma.$connect();
  await redis.connect();

  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: true, credentials: true },
    // Permitir ambos transportes para mejor compatibilidad:
    // 1. websocket: conexión TCP estable (preferida)
    // 2. polling: fallback si WebSocket falla (usado durante handshake inicial)
    // Con sticky sessions en Traefik (ya configurado), ambos funcionen sin conflicto.
    transports: ['websocket', 'polling'],
    // Aumentar timeouts para tolerar latencia interna del cluster
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // ✅ Setup Redis adapter para Socket.io - esencial para escalabilidad distribuida
  try {
    io.adapter(createAdapter(redis, redis.duplicate()));
    logger.info('Socket.io Redis adapter configured for distributed communication');
  } catch (error) {
    logger.warn({ error }, 'Socket.io Redis adapter setup failed, falling back to local adapter');
  }

  setSocketServer(io);
  setupSocketServer(io);

  const shutdown = async () => {
    logger.info('Graceful shutdown started');
    const forceExitTimer = setTimeout(() => process.exit(1), 30_000);
    server.close();
    await io.close();
    await redis.quit();
    await prisma.$disconnect();
    clearTimeout(forceExitTimer);
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'NexusNet API started');
  });
}

bootstrap().catch((error: unknown) => {
  logger.error({ error }, 'Failed to bootstrap application');
  process.exit(1);
});
