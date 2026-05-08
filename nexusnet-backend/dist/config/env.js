"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().int().positive().default(3000),
    DATABASE_URL: zod_1.z.string().min(1),
    DATABASE_REPLICA_URL: zod_1.z.string().optional(),
    REDIS_URL: zod_1.z.string().default('redis://redis:6379'),
    // Sentinel: "host1:port1,host2:port2,host3:port3"
    REDIS_SENTINEL_HOSTS: zod_1.z.string().optional(),
    REDIS_SENTINEL_NAME: zod_1.z.string().default('nexusnet-master'),
    JWT_SECRET: zod_1.z.string().min(16),
    JWT_REFRESH_SECRET: zod_1.z.string().min(16),
    JWT_EXPIRES_IN: zod_1.z.string().default('15m'),
    MFA_ISSUER: zod_1.z.string().default('NexusNet'),
    BCRYPT_ROUNDS: zod_1.z.coerce.number().int().min(10).max(15).default(12),
    CORS_ORIGIN: zod_1.z.string().default('*'),
    RATE_LIMIT_WINDOW_MS: zod_1.z.coerce.number().int().positive().default(900000),
    SMTP_HOST: zod_1.z.string().optional().default(''),
    SMTP_PORT: zod_1.z.coerce.number().int().optional().default(587),
    SMTP_USER: zod_1.z.string().optional().default(''),
    SMTP_PASS: zod_1.z.string().optional().default(''),
    AWS_S3_BUCKET: zod_1.z.string().optional().default(''),
    AWS_REGION: zod_1.z.string().optional().default('us-east-1'),
    LOG_LEVEL: zod_1.z.string().default('info'),
    SENTRY_DSN: zod_1.z.string().optional().default(''),
    ADMIN_EMAIL: zod_1.z.string().optional().default(''),
    ADMIN_USERNAME: zod_1.z.string().optional().default(''),
    ADMIN_PASSWORD: zod_1.z.string().optional().default(''),
    ADMIN_DISPLAY_NAME: zod_1.z.string().optional().default(''),
    // ─── OAuth ────────────────────────────────────────────────────────────────
    /** Base URL del BACKEND (la que reciben Google/GitHub para el callback). */
    OAUTH_CALLBACK_BASE_URL: zod_1.z.string().url().default('http://localhost:3000'),
    /** Base URL del FRONTEND (a donde redirigimos con los tokens tras el login). */
    FRONTEND_URL: zod_1.z.string().url().default('http://localhost:5173'),
    GITHUB_CLIENT_ID: zod_1.z.string().optional().default(''),
    GITHUB_CLIENT_SECRET: zod_1.z.string().optional().default(''),
    GOOGLE_CLIENT_ID: zod_1.z.string().optional().default(''),
    GOOGLE_CLIENT_SECRET: zod_1.z.string().optional().default('')
});
exports.env = envSchema.parse(process.env);
