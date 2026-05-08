"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = void 0;
const prisma_1 = require("./config/prisma");
const redis_1 = require("./config/redis");
const metrics_1 = require("./config/metrics");
const http_1 = require("./utils/http");
exports.healthRouter = {
    health(_req, res) {
        res.status(200).json((0, http_1.successResponse)({ status: 'ok' }, 'Healthy'));
    },
    async ready(_req, res) {
        try {
            await prisma_1.prisma.$queryRaw `SELECT 1`;
            await redis_1.redis.ping();
            res.status(200).json((0, http_1.successResponse)({ status: 'ready' }, 'Ready'));
        }
        catch {
            res.status(503).json((0, http_1.errorResponse)('Service not ready'));
        }
    },
    async metrics(_req, res) {
        res.setHeader('Content-Type', metrics_1.promClient.register.contentType);
        res.end(await metrics_1.promClient.register.metrics());
    }
};
