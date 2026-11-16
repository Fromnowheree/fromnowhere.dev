#!/usr/bin/env bash
# Provisioning: create the site's first admin from ADMIN_EMAIL in .env, with a generated password
# printed once on this terminal (scripts/create-admin.mjs, run inside the app container).
#
# Run from the project directory on the VPS, after `docker compose up -d` and before the site's
# address is handed over:
#
#   ./scripts/create-admin.sh
#
# Until it has run, nobody can claim the admin: Payload's "create first user" form refuses
# without the provisioning token (src/lib/provision.ts), and Caddy refuses its endpoint from
# outside. It refuses again once any account exists.
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="${COMPOSE:-docker compose}"

# The password goes to this terminal only: `exec` output is not part of the container's log.
# shellcheck disable=SC2086 # COMPOSE is a command with arguments ("docker compose").
exec $COMPOSE exec -T app node scripts/create-admin.mjs
