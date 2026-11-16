#!/usr/bin/env bash
# Restores one part of a backup (scripts/backup.sh) from the DECRYPTED stream on stdin:
#
#   db      the site's database          backups/db-<stamp>.dump.age
#   media   the uploaded images          backups/media-<stamp>.tar.gz.age
#   stats   the visitor statistics       backups/umami-<stamp>.dump.age (with compose.stats.yml)
#
# Decrypt on your own machine, where the private key is, and pipe it to the VPS, so the key never
# goes on the server and nothing is written there in the clear:
#
#   age -d -i fnw-backup-key.txt db-<stamp>.dump.age \
#     | ssh vps 'cd /srv/fnw && ./scripts/restore.sh db'
#
# A database is restored into a scratch database first, while the site keeps running, in one
# transaction that stops at the first error: a damaged or wrong file fails there and the site is
# left exactly as it was. Only a complete copy replaces the live database, which is kept as
# `<name>_before_restore` until the next restore. Then the stack starts on the image .env names
# (APP_IMAGE), which applies that version's migrations to the restored data: to undo a release,
# set APP_IMAGE back to the version the backup was taken with first (README, "Upgrading").
#
# COMPOSE overrides the compose command (default "docker compose"; "podman compose" for Podman).
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="${COMPOSE:-docker compose}"
# shellcheck disable=SC2086 # COMPOSE is a command with arguments ("docker compose").
compose() { $COMPOSE "$@"; }
# Every compose call but the one that reads the backup gets no stdin, so none of them can swallow
# a part of the stream.
quiet() { compose "$@" < /dev/null; }

refuse() {
  echo "restore: $*" >&2
  exit 1
}

part="${1:-}"
case "$part" in
  db | media | stats) ;;
  *) refuse "say what to restore: db, media or stats (README, \"Restoring\")" ;;
esac
[ -t 0 ] && refuse "nothing on stdin: pipe the decrypted backup in (README, \"Restoring\")"

# Restores database $1 (empty: the site's own, POSTGRES_DB) owned by role $2 from stdin, stopping
# the services named after them only once the copy is complete.
# shellcheck disable=SC2016 # the variables are expanded by the container's shell, on purpose
restore_database() {
  local name="$1" owner="$2"
  shift 2
  quiet exec -T db sh -c '
    set -e
    db="${1:-$POSTGRES_DB}"
    dropdb -U "$POSTGRES_USER" --if-exists "${db}_restoring"
    createdb -U "$POSTGRES_USER" -O "$2" "${db}_restoring"' sh "$name" "$owner"

  if ! compose exec -T db sh -c '
    db="${1:-$POSTGRES_DB}"
    pg_restore -U "$POSTGRES_USER" -d "${db}_restoring" --exit-on-error --single-transaction' \
    sh "$name"; then
    quiet exec -T db sh -c 'dropdb -U "$POSTGRES_USER" --if-exists "${1:-$POSTGRES_DB}_restoring"' \
      sh "$name" || true
    refuse "the backup could not be restored; nothing was changed and the site is as it was"
  fi

  quiet stop "$@"
  quiet exec -T db sh -c '
    set -e
    db="${1:-$POSTGRES_DB}"
    psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d postgres \
      -v live="$db" -v old="${db}_before_restore" -v new="${db}_restoring" <<'"'SQL'"'
DROP DATABASE IF EXISTS :"old" WITH (FORCE);
\o /dev/null
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = :'"'live'"';
\o
ALTER DATABASE :"live" RENAME TO :"old";
ALTER DATABASE :"new" RENAME TO :"live";
SQL' sh "$name"
}

case "$part" in
  db)
    # The app's own login must exist before the scratch database can belong to it (an install
    # from before 0.1.4 has none yet).
    quiet exec -T db sh /docker-entrypoint-initdb.d/00-app.sh
    restore_database '' app caddy app
    # A backup from before 0.1.4 holds objects of the superuser's: handed to the app's login. The
    # statistics' setup takes the new database's connections away from other roles again.
    quiet exec -T db sh /docker-entrypoint-initdb.d/00-app.sh
    quiet exec -T db sh /docker-entrypoint-initdb.d/01-umami.sh
    ;;
  stats)
    restore_database umami umami umami
    quiet exec -T db sh /docker-entrypoint-initdb.d/01-umami.sh
    ;;
  media)
    # Into the running app's uploads volume. Files uploaded after the backup stay; nothing links
    # to them in a database of that night.
    compose exec -T app tar -C /app -xzf -
    ;;
esac

quiet up -d
echo "restore: $part restored; the stack is starting (docker compose ps, docker compose logs app)."
