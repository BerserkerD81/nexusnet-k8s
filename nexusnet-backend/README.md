# NexusNet Backend

NexusNet is a Twitter-like social network backend built with Node.js 20, Express, Prisma, PostgreSQL, Redis, Socket.IO, and Kubernetes.

## Architecture

```text
Clients
  |
  v
NGINX Ingress / Reverse Proxy
  |
  +--> Express API + Socket.IO -----> PostgreSQL (Prisma)
  |           |                      
  |           +---------------------> Redis (cache, pub/sub, presence, queues)
  |
  +--> Prometheus / Grafana
```

## Stack

- Node.js 20 + TypeScript
- Express.js
- PostgreSQL 16 + Prisma ORM
- Redis 7
- Socket.IO
- JWT access/refresh tokens + TOTP MFA
- BullMQ queues
- Prometheus + Grafana
- Swagger/OpenAPI 3.0
- Jest + Supertest

## Quick start

1. Copy `.env.example` to `.env` and fill in the values.
2. Install dependencies.
3. Run `npm run prisma:generate`.
4. Apply migrations with `npm run prisma:migrate`.
5. Start the API with `npm run dev`.

## API docs

Swagger UI is exposed at `/docs` when the server is running.

## Health and metrics

- `GET /health`
- `GET /ready`
- `GET /metrics`

## Deployment

- Docker assets live under `docker/`
- Kubernetes manifests live under `k8s/`
- Monitoring config lives under `monitoring/`
