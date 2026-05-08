#!/bin/bash
set -e

echo "Initializing Prisma migrations table if needed..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    DO $$
    BEGIN
        IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
            DELETE FROM "_prisma_migrations" WHERE finished_at IS NULL;
        END IF;
    END
    $$;
EOSQL

echo "Database initialization complete"
