"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = __importDefault(require("node:http"));
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const app_1 = require("./app");
const env_1 = require("./config/env");
const logger_1 = require("./config/logger");
const index_1 = require("./sockets/index");
const io_1 = require("./sockets/io");
const prisma_1 = require("./config/prisma");
const redis_1 = require("./config/redis");
async function bootstrap() {
    await prisma_1.prisma.$connect();
    await redis_1.redis.connect();
    const app = (0, app_1.createApp)();
    const server = node_http_1.default.createServer(app);
    const io = new socket_io_1.Server(server, {
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
        io.adapter((0, redis_adapter_1.createAdapter)(redis_1.redis, redis_1.redis.duplicate()));
        logger_1.logger.info('Socket.io Redis adapter configured for distributed communication');
    }
    catch (error) {
        logger_1.logger.warn({ error }, 'Socket.io Redis adapter setup failed, falling back to local adapter');
    }
    (0, io_1.setSocketServer)(io);
    (0, index_1.setupSocketServer)(io);
    const shutdown = async () => {
        logger_1.logger.info('Graceful shutdown started');
        const forceExitTimer = setTimeout(() => process.exit(1), 30_000);
        server.close();
        await io.close();
        await redis_1.redis.quit();
        await prisma_1.prisma.$disconnect();
        clearTimeout(forceExitTimer);
        process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    server.listen(env_1.env.PORT, () => {
        logger_1.logger.info({ port: env_1.env.PORT }, 'NexusNet API started');
    });
}
bootstrap().catch((error) => {
    logger_1.logger.error({ error }, 'Failed to bootstrap application');
    process.exit(1);
});
