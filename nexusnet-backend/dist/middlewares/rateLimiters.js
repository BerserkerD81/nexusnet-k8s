"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalRateLimiter = exports.messageRateLimiter = exports.postRateLimiter = exports.authRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("../config/env");
// Skip rate limiting para health checks y dev
const skip = (req) => {
    return req.path.includes('/health') ||
        req.path.includes('/ready') ||
        req.path.includes('/metrics') ||
        req.path.includes('/docs') ||
        env_1.env.NODE_ENV === 'development';
};
// Auth limiter: 60 requests por 15 minutos (permite recarga sin problemas)
exports.authRateLimiter = (0, express_rate_limit_1.default)({
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
exports.postRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip,
    message: 'Has alcanzado el límite de posts'
});
// Message limiter: 300 mensajes por minuto
exports.messageRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip,
    message: 'Has alcanzado el límite de mensajes'
});
// Global limiter: 10000 requests por 15 minutos (muy generoso)
exports.globalRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: env_1.env.RATE_LIMIT_WINDOW_MS,
    limit: 10000,
    standardHeaders: true,
    legacyHeaders: false,
    skip,
    message: 'Demasiadas solicitudes, intenta más tarde',
});
