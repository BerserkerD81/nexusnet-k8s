#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT/deploy/docker-compose.yml"

echo "Starting NexusNet local stack with Docker Compose..."
docker compose -f "$COMPOSE_FILE" up -d --build

echo "Waiting for API to be healthy..."
sleep 8

echo "Running prisma generate and push inside api container..."
docker compose -f "$COMPOSE_FILE" exec -T api npm run prisma:generate || true
docker compose -f "$COMPOSE_FILE" exec -T api npm run prisma:push || true

echo "Seeding admin user (uses env ADMIN_* from compose)..."
docker compose -f "$COMPOSE_FILE" exec -T api npm run seed:admin || true

echo "All services started."
docker compose -f "$COMPOSE_FILE" ps
