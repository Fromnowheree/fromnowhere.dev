#!/usr/bin/env bash
# Provisioning, with visitor statistics only: replace Umami's built-in admin password
# (admin / umami) with a generated one, printed once on this terminal (scripts/stats-admin.mjs,
# run inside the Umami container).
#
# Run from the project directory on the VPS, after starting the stack with compose.stats.yml and
# BEFORE setting STATS_DOMAIN, which publishes the dashboard:
#
#   docker compose -f compose.yml -f compose.stats.yml up -d
#   ./scripts/stats-admin.sh
#
# Until STATS_DOMAIN is set nothing outside the server reaches Umami's sign-in: the site's own
# domain passes only the tracker and the endpoint it reports to (caddy/Caddyfile). The script
# refuses once the default password no longer works, so it never replaces a chosen one.
set -euo pipefail
cd "$(dirname "$0")/.."

# Every command needs the statistics file; COMPOSE_FILE in .env may already name it.
COMPOSE="${COMPOSE:-docker compose -f compose.yml -f compose.stats.yml}"

# The password goes to this terminal only: `exec` output is not part of the container's log.
# Umami's image has Node but not this repository, so the script travels on standard input.
# shellcheck disable=SC2086 # COMPOSE is a command with arguments ("docker compose ...").
exec $COMPOSE exec -T umami node --input-type=module - < scripts/stats-admin.mjs
