#!/bin/sh
set -e

echo "Waiting for database to be ready..."
sleep 3

echo "Generating Prisma client..."
npm run prisma:generate

echo "Starting application..."
exec node dist/index.js
