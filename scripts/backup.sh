#!/usr/bin/env bash
# Nightly backup of one clinic's site, ENCRYPTED: the database, the uploaded images and, when it
# exists, the visitor statistics, each piped straight from the container into `age` and written
# only as ciphertext. No plaintext dump ever touches the disk, not even for a moment.
#
# Run from cron on the VPS, from the project directory:
#
#   30 3 * * * cd /srv/publicweb && ./scripts/backup.sh 2>&1 | logger -t publicweb-backup
#
# Settings, from the environment or from .env (read line by line, never sourced):
#
#   BACKUP_RECIPIENT   the age public key(s) the backups are encrypted to, comma-separated
#                      (age1...). Required: without one the script refuses and reads nothing.
#                      The matching private key is NOT on the VPS; whoever holds it can restore.
#   BACKUP_KEEP_DAYS   delete backups older than this many days (default 30)
#   BACKUP_DIR         where the encrypted files go (default ./backups)
#
# It also deletes visitor statistics older than the privacy policy promises (13 months).
# Restoring: scripts/restore.sh (README, "Restoring").
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="${COMPOSE:-docker compose}"
AGE="${AGE:-age}"
# Months of visitor statistics to keep. The privacy policy states this period; change both together.
STATS_KEEP_MONTHS=13

# The value of KEY: the environment wins, then the last `KEY=` line of .env, with one pair of
# surrounding quotes removed. .env is never sourced, so nothing in it is run as shell.
setting() {
  local key="$1" line value=""
  if [ -n "${!key:-}" ]; then
    printf '%s' "${!key}"
    return
  fi
  if [ -f .env ]; then
    while IFS= read -r line || [ -n "$line" ]; do
      case "$line" in "$key="*) value="${line#*=}" ;; esac
    done < .env
  fi
  value="${value%$'\r'}"
  case "$value" in
    \"*\") value="${value#\"}"; value="${value%\"}" ;;
    \'*\') value="${value#\'}"; value="${value%\'}" ;;
  esac
  printf '%s' "$value"
}

refuse() {
  echo "backup: $*" >&2
  exit 1
}

recipients="$(setting BACKUP_RECIPIENT)"
keep_days="$(setting BACKUP_KEEP_DAYS)"
keep_days="${keep_days:-30}"
backup_dir="$(setting BACKUP_DIR)"
backup_dir="${backup_dir:-backups}"

# Everything is checked before the database is read, so a refusal leaves no trace at all.
[ -n "$recipients" ] || refuse "BACKUP_RECIPIENT is not set; refusing to write an unencrypted backup."
recipient_args=()
IFS=',' read -r -a recipient_list <<< "$recipients"
for recipient in "${recipient_list[@]}"; do
  recipient="${recipient//[[:space:]]/}"
  [ -n "$recipient" ] || continue
  [[ "$recipient" =~ ^age1[0-9a-z]{58,}$ ]] || refuse "BACKUP_RECIPIENT holds something that is not an age public key (age1...)."
  recipient_args+=(-r "$recipient")
done
[ "${#recipient_args[@]}" -gt 0 ] || refuse "BACKUP_RECIPIENT is empty."
[[ "$keep_days" =~ ^[1-9][0-9]*$ ]] || refuse "BACKUP_KEEP_DAYS must be a whole number of days, at least 1."
command -v "$AGE" > /dev/null || refuse "age is not installed (apt install age)."

umask 077
mkdir -p "$backup_dir"
stamp="$(date +%Y%m%d-%H%M%S)"

# A file is written as NAME.partial and renamed only once age has finished, so a failed dump
# never leaves something that looks like a backup. Partials are removed whatever happens.
trap 'rm -f "$backup_dir"/*.partial' EXIT

# Runs the command after $1 and writes its output to $1, encrypted. The file is renamed into
# place only if the command AND age both succeeded (pipefail), so a dump that died halfway is
# never kept as if it were a backup.
seal() {
  local target="$1"
  shift
  if "$@" | "$AGE" "${recipient_args[@]}" -o "$target.partial"; then
    mv "$target.partial" "$target"
  else
    rm -f "$target.partial"
    refuse "failed writing $(basename "$target"); nothing was kept for it."
  fi
}

# shellcheck disable=SC2086 # COMPOSE is a command with arguments ("docker compose").
compose() { $COMPOSE "$@"; }

# pg_dump of database $1 (empty: the site's own) to stdout. The user and the site's database name
# come from the db container's own environment, so nothing here needs the password.
dump() {
  # shellcheck disable=SC2016 # expanded by the container's shell, on purpose
  compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "${1:-$POSTGRES_DB}" --format=custom' sh "$1"
}

# Runs the SQL on stdin in database $1 (empty: the site's own) and prints bare rows.
query() {
  # shellcheck disable=SC2016 # expanded by the container's shell, on purpose
  compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -q -tA -U "$POSTGRES_USER" -d "${1:-$POSTGRES_DB}"' sh "$1"
}

seal "$backup_dir/db-$stamp.dump.age" dump ""
seal "$backup_dir/media-$stamp.tar.gz.age" compose exec -T app tar -C /app -czf - media

# Visitor statistics (Umami), once its database exists.
stats_cleanup_failed=""
if [ "$(echo "SELECT 1 FROM pg_database WHERE datname = 'umami';" | query "")" = 1 ]; then
  # First delete visits older than STATS_KEEP_MONTHS, then visitors with no visits left, so the
  # backup doesn't keep them either. Skipped until Umami has created its tables. The table names
  # are Umami's own: should an update rename one, the deletion fails as a whole (one
  # transaction), the backups and the retention below still run, and the script ends in failure.
  if [ "$(echo "SELECT to_regclass('public.website_event') IS NOT NULL;" | query umami)" = t ]; then
    if ! query umami <<SQL
BEGIN;
CREATE TEMP TABLE cutoff AS SELECT now() - interval '$STATS_KEEP_MONTHS months' AS at;
DELETE FROM event_data WHERE created_at < (SELECT at FROM cutoff);
DELETE FROM website_event WHERE created_at < (SELECT at FROM cutoff);
DELETE FROM session_data WHERE created_at < (SELECT at FROM cutoff);
DELETE FROM revenue WHERE created_at < (SELECT at FROM cutoff);
DELETE FROM session_replay WHERE created_at < (SELECT at FROM cutoff);
DELETE FROM heatmap_event WHERE created_at < (SELECT at FROM cutoff);
DELETE FROM session s WHERE s.created_at < (SELECT at FROM cutoff)
  AND NOT EXISTS (SELECT 1 FROM website_event e WHERE e.session_id = s.session_id);
DELETE FROM session_link l
  WHERE NOT EXISTS (SELECT 1 FROM session s WHERE s.session_id = l.session_id);
COMMIT;
SQL
    then
      stats_cleanup_failed=1
    fi
  fi
  seal "$backup_dir/umami-$stamp.dump.age" dump umami
fi

# Retention: only this script's own files, only once they are older than BACKUP_KEEP_DAYS.
find "$backup_dir" -maxdepth 1 -type f \
  \( -name 'db-*.dump.age' -o -name 'media-*.tar.gz.age' -o -name 'umami-*.dump.age' \) \
  -mtime +"$keep_days" -delete

echo "backup $stamp done: encrypted to $((${#recipient_args[@]} / 2)) recipient(s), keeping $keep_days days"
if [ -n "$stats_cleanup_failed" ]; then
  refuse "but visits older than $STATS_KEEP_MONTHS months could NOT be deleted from the statistics (has an Umami update renamed its tables?); the privacy policy promises that they are."
fi
