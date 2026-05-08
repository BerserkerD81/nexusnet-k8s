#!/bin/bash
set -e

# If PATRONI_NAME is set, replace placeholders in /etc/patroni.yml
CONFIG_SRC=/etc/patroni.yml
CONFIG_DST=/tmp/patroni-${PATRONI_NAME:-node}.yml

# Copy mounted config to a writable location, then substitute
cp "$CONFIG_SRC" "$CONFIG_DST" || true
if [ -n "$PATRONI_NAME" ]; then
  sed -i "s/{{NAME}}/$PATRONI_NAME/g" "$CONFIG_DST" || true
fi

if [ -z "$(ls -A /var/lib/postgresql/data 2>/dev/null)" ]; then
  chown -R postgres:postgres /var/lib/postgresql/data
fi

if [ "$(id -u)" = "0" ]; then
  exec su - postgres -c "patroni $CONFIG_DST"
else
  exec patroni "$CONFIG_DST"
fi
