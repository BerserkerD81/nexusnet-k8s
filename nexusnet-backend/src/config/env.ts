import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  DATABASE_REPLICA_URL: z.string().optional(),
  REDIS_URL: z.string().default('redis://redis:6379'),
  // Sentinel: "host1:port1,host2:port2,host3:port3"
  REDIS_SENTINEL_HOSTS: z.string().optional(),
  REDIS_SENTINEL_NAME: z.string().default('nexusnet-master'),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('15m'),
  MFA_ISSUER: z.string().default('NexusNet'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().optional().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  AWS_S3_BUCKET: z.string().optional().default(''),
  AWS_REGION: z.string().optional().default('us-east-1'),
  LOG_LEVEL: z.string().default('info'),
  SENTRY_DSN: z.string().optional().default(''),
  ADMIN_EMAIL: z.string().optional().default(''),
  ADMIN_USERNAME: z.string().optional().default(''),
  ADMIN_PASSWORD: z.string().optional().default(''),
  ADMIN_DISPLAY_NAME: z.string().optional().default(''),

  // ─── OAuth ────────────────────────────────────────────────────────────────
  /** Base URL del BACKEND (la que reciben Google/GitHub para el callback). */
  OAUTH_CALLBACK_BASE_URL: z.string().url().default('http://localhost:3000'),
  /** Base URL del FRONTEND (a donde redirigimos con los tokens tras el login). */
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  GITHUB_CLIENT_ID: z.string().optional().default(''),
  GITHUB_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default('')
});

export const env = envSchema.parse(process.env);