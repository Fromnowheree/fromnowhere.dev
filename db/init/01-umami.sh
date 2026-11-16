#!/bin/sh
# Own role and database for the visitor statistics (Umami), which creates its tables on start.
# The role can't log in to the site's database, so a flaw in Umami can't reach the site's content or admin users.
# Postgres runs this only when the data volume is created. On an existing volume, run it by hand
# (README "Visitor statistics"); it's safe to run again.
set -eu

# Statistics are optional (decision 24): without a password for Umami's login there is no Umami.
if [ -z "${UMAMI_DB_PASSWORD:-}" ]; then
  echo "UMAMI_DB_PASSWORD is empty: visitor statistics are off, no Umami database created."
  exit 0
fi

psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres \
  -v pw="$UMAMI_DB_PASSWORD" -v db="$POSTGRES_DB" <<'SQL'
SELECT 'CREATE ROLE umami LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'umami')
\gexec
ALTER ROLE umami WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'pw';
SELECT 'CREATE DATABASE umami OWNER umami'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'umami')
\gexec
ALTER DATABASE umami OWNER TO umami;
REVOKE CONNECT ON DATABASE :"db" FROM PUBLIC;
-- Tables an earlier setup created while Umami still logged in as the superuser.
\c umami
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner <> 'umami' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO umami', t.tablename);
  END LOOP;
END $$;
SQL
