#!/bin/sh
# The site's own database login, `app` (app-role.psql says what it may do and why). Postgres runs
# this only when the data volume is created. On an existing volume, run it by hand (README,
# "Upgrading", 0.1.4); it's safe to run again.
set -eu

: "${APP_DB_PASSWORD:?APP_DB_PASSWORD is empty: set it in .env (openssl rand -hex 32)}"

psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v pw="$APP_DB_PASSWORD" -v db="$POSTGRES_DB" \
  -f /docker-entrypoint-initdb.d/app-role.psql
