# fromnowhere.dev

The Fromnowhere studio site: the point every project's line leaves from. A route map and a
departures board of the projects, a page per project, About, and a contact form. English and
Croatian. The concept is in [`docs/vision.html`](docs/vision.html).

- **Next.js 16** (App Router) renders the public site.
- **Payload CMS 3** runs inside the same app and serves the editor at `/admin`.
- **PostgreSQL 17** holds the content; uploaded images live on disk in a volume.
- **Caddy** terminates TLS with automatic certificates, and can serve the other fromnowhere.dev
  sites on the same server (`caddy/sites/`).
- **Umami** (optional, off by default) counts visits without cookies, on the same server.
- The look is the **Fromnowhere design system**, copied in as fnwygo does it: `design/` (the
  system's README, patterns, motion and logo rules, tokens) and `src/styles/fnw/` (its CSS).

> **Status: scaffold.** Started on 16 November 2026 from a copy of NMT-PublicWeb's committed files
> (its infrastructure, security hardening, language routing and contact relay), with the clinic
> layer replaced. The home page has the board; the route map is the next step (vision, "Build
> order").

## Local development

You need Node 26 (`.nvmrc`) and pnpm 12.20.0. `pnpm-workspace.yaml` refuses any other pnpm
version and any Node older than `engines`. Node 25 and later ship no corepack, so install the
pinned pnpm with npm:

```sh
nvm use
npm i -g "$(node -p "require('./package.json').packageManager")"
pnpm install
podman compose -f compose.dev.yml up -d   # or: docker compose -f compose.dev.yml up -d
cp .env.example .env                      # set PAYLOAD_SECRET (openssl rand -hex 32),
                                          # SITE_URL=http://localhost:3000, PAYLOAD_SEED=true
pnpm dev                                  # http://localhost:3000, editor at /admin
```

With `PAYLOAD_SEED=true` an empty database is filled with the starting content: the four
projects, their short links, the studio's words and the About and Privacy pages, in English and
Croatian (`src/seed/index.ts`). It never overwrites anything.

A project's window (a phone-width picture of its destination, on its page) is seeded from the
manifest `src/seed/windowSeeds.ts` and the committed captures `src/seed/windows/*.webp`, taken
with `pnpm capture:windows` (Playwright on this machine; never in CI or the image). A window is
added only for a published destination: a real, live page, no demo or seed data, no one's
personal details, and the client's agreement for a client's site. Until one is live the manifest
is empty and the seed attaches no windows.

### Checks

```sh
pnpm lint
pnpm typecheck
pnpm test:int        # Vitest against a throwaway Postgres (AGENTS.md); needs `age` on PATH
pnpm build
```

### Changing the schema

Development pushes the schema straight into the database; production only applies migrations.
After changing a collection, global or field: `pnpm generate:types`, then
`pnpm payload migrate:create <name>`, and commit the `.ts`, its `.json` snapshot and `index.ts`.
CI fails a schema change that has no migration (AGENTS.md, "Migrations").

## What lives in the admin

| Admin section         | What it holds                                                                                                                                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content → Projects    | Each published project is a line: its number, status (anything but Running draws it dashed), kind, addresses (the first is where the line ends), one sentence, the story, what it is built with, a window picture. A draft is hidden (mtnet.hr waits there) |
| Content → Pages       | Text pages: About, Privacy, anything like them, at `/<language>/<slug>`                                                                                                                                                                                     |
| Content → Short links | `fromnowhere.dev/<word>` to a project or an address: `/ygo`, `/giogio`, `/nmt`, `/gati`                                                                                                                                                                     |
| Settings → Studio     | The home page's headline and lede, the e-mail address, profiles elsewhere, search defaults, the statistics switch                                                                                                                                           |

## Addresses

Every page carries its language: `/en/...` and `/hr/...`, the rest of the address the same in
both, so the EN / HR switch keeps the visitor on the page. An address without a language goes
through `src/proxy.ts` to `pick-language`, which first checks whether it is one word naming a
short link (and redirects there), and otherwise picks the visitor's language (their earlier
choice, then their browser's, then English).

## The contact form

A relay, inherited unchanged from NMT-PublicWeb: the message goes from a send-only mail account
(`CONTACT_*` in `.env`) to the studio's inbox, with Reply-To set to the visitor, and nothing is
stored. Spam is held off by a honeypot, a per-address rate limit, a minimum fill-in time and a
self-hosted proof of work (ALTCHA); no third party is involved. Without the mail account the form
is not shown and the page gives the e-mail address instead.

## Other sites on this server

The plan (vision, "Hosting") is one server for the fromnowhere.dev family behind this stack's
Caddy. Each other site gets a block in `caddy/sites/<name>.caddy` (see the README there), and its
container joins a network Caddy is on. That second half is not wired yet: until it is, every
other site keeps its own Caddy on its own server.

## Installing on a VPS

One server (2–4 GB, with the other fromnowhere.dev sites beside it), one directory, for example
`/srv/fnw`, holding a checkout of this repository (for `compose.yml`, `caddy/`, `db/` and
`scripts/`) and its `.env`. The image is built by CI, never on the VPS.

1. **DNS**: point the bare domain and `www.` at the VPS, with an AAAA record too if the VPS has
   IPv6 (and `stats.` for statistics).
2. **The image**: CI builds `fromnowhere-web:<version>` for a `v<version>` tag and keeps no copy
   (there is no registry yet). Build the same image from the release's tag on your own machine,
   for the VPS's processor (the commands are in the `Dockerfile` header), and copy it over:
   `docker save fromnowhere-web:<version> | ssh vps docker load`.
3. **`.env`**: `cp .env.example .env` and fill it in: `APP_IMAGE` (`fromnowhere-web:<version>`),
   `SITE_DOMAIN` (the bare domain), `SITE_URL`, `POSTGRES_PASSWORD`, `APP_DB_PASSWORD` and
   `PAYLOAD_SECRET` (each `openssl rand -hex 32`), `ADMIN_EMAIL`, `BACKUP_RECIPIENT`, the
   `CONTACT_*` mail account. Set `PAYLOAD_SEED=true` for the first start only, so the empty database gets the
   starting content, then set it back to `false`. `chmod 600 .env`. The app logs in to the database as its own role, `app`, which owns the
   site's database and nothing else (`db/init/app-role.psql`); `POSTGRES_USER` is the superuser,
   for backups and maintenance only.
4. **Start**: `docker compose up -d`. The app applies its migrations on first start; Caddy waits
   for the app's health check, then gets the certificates.
5. **The first admin**: `./scripts/create-admin.sh` (below).
6. **Content**: sign in at `https://<domain>/admin`, check the projects' statuses and addresses,
   and fill in Studio (e-mail, profiles) and the About page.
7. **Backups**: add the cron line (below) and run it once by hand.

`docker compose` here means Docker Compose v2 on Docker Engine 27 or newer, run as root (the
default). Podman reads the same files with `podman compose`, but only rootful Podman will do on the
server: see below. The scripts call `docker compose`; with Podman, run them with
`COMPOSE="podman compose"` in front (in the crontab line too).

### Visitors' addresses

The contact form's rate limit is per visitor address: the address Caddy saw, which it passes to the
app as the last `X-Forwarded-For` entry. If Caddy sees the container network's gateway instead of
the visitor, every visitor shares one limit, and one script sending bare requests can keep the
form closed for everyone. Two setups do that, and the stack avoids both:

- **Docker with IPv6 visitors.** On an IPv4-only network, Docker's userland proxy carries IPv6
  connections over IPv4 and the visitor's address is lost. `compose.yml` therefore turns IPv6 on
  for the stack's network (`enable_ipv6`), so Docker forwards IPv6 the way it forwards IPv4, with
  the address kept. Docker Engine 27 and newer choose the subnet and set up `ip6tables`
  themselves; an older engine refuses to create the network, which is the time to upgrade it.
- **Rootless Podman.** Its port forwarder hands every connection to Caddy from the gateway's
  address. Run the stack with rootful Podman (`sudo podman compose ...`) or with Docker.

The app checks this as it runs: in production, the first request whose address is an internal one
(a private, loopback or link-local address, or none at all) logs one warning, `Rate limiting sees
the internal address ...`. If it appears in `docker compose logs app`, fix the setup before the
site goes live.

### The first admin

The first admin account is created at provisioning, never by whoever opens `/admin` first:

```sh
./scripts/create-admin.sh
```

It creates the account for `ADMIN_EMAIL` with a generated password, prints the password ONCE on
the terminal and stores it nowhere. Change it after the first sign-in. The script runs inside the app container and calls Payload's first-user endpoint with a
token derived from `PAYLOAD_SECRET`; without that token the endpoint refuses (and Caddy does not
expose it at all), so on a fresh install nobody can claim the admin before the script runs. Once
any account exists it refuses again; further accounts are made in the admin by an admin.

### Visitor statistics (optional, off by default)

Umami is added by `compose.stats.yml`, with every credential generated at installation. Put
`COMPOSE_FILE=compose.yml:compose.stats.yml` in `.env` so that every `docker compose` command below includes it.

1. In `.env`: `UMAMI_APP_SECRET` and `UMAMI_DB_PASSWORD` (each `openssl rand -hex 32`). Compose
   refuses to start Umami without them. On a fresh database volume `db/init/01-umami.sh` creates
   Umami's own role and database; on an existing one, `docker compose up -d db` (to pass the
   password on), then run it by hand:
   `docker compose exec db sh /docker-entrypoint-initdb.d/01-umami.sh` (safe to repeat).
2. `docker compose up -d`, then `./scripts/stats-admin.sh`. Umami starts with a built-in
   `admin` / `umami` account; the script replaces that password with a generated one and prints
   it ONCE (hand it over now; it is stored nowhere else). It refuses once the default password
   no longer works, so it never replaces a password someone chose.
3. Only then set `STATS_DOMAIN` (it publishes the dashboard) and `docker compose up -d caddy`.
   Before that, nothing outside the server reaches Umami's sign-in: the site's own domain passes
   only the tracker and the endpoint it reports to.
4. Add the website in Umami and set `UMAMI_WEBSITE_ID`, and
   `UMAMI_SCRIPT_URL=https://<domain>/stats/script.js` (Caddy serves the tracker on the site's own
   domain). `docker compose up -d app` to pass them on.
5. Switch statistics on under Studio → Search and statistics. Until all of this, the site
   loads no statistics script. `scripts/backup.sh` deletes visits older than 13 months.

### Backups

`scripts/backup.sh` writes the database, the uploaded images and (when present) the statistics,
each piped from its container straight into [age](https://age-encryption.org) and stored only as
ciphertext in `backups/`. No plaintext dump touches the disk. It refuses to run without
`BACKUP_RECIPIENT`, and deletes its own backups older than `BACKUP_KEEP_DAYS` (default 30).

Make the key pair OFF the VPS, keep the private key where you keep your other keys, and
put only the public key on the server:

```sh
age-keygen -o fnw-backup-key.txt     # on your own machine; prints "Public key: age1..."
# .env on the VPS: BACKUP_RECIPIENT=age1...   (several, comma-separated, are allowed)
sudo apt install age                         # on the VPS
30 3 * * * cd /srv/fnw && ./scripts/backup.sh 2>&1 | logger -t fnw-backup   # crontab
```

Its output goes to the system journal, which rotates it: `journalctl -t fnw-backup -n 20`
shows the last nights, each ending in `backup <stamp> done` or in what went wrong. Nothing else
tells anyone a backup failed, so look after an upgrade and now and then.

A backup that is only on the VPS is lost with it. Copy `backups/` off the server regularly, from a
machine of yours that runs every day (it is useless without the private key, which is the
point), for example from that machine's crontab:

```sh
15 9 * * * rsync -a vps:/srv/fnw/backups/ "$HOME/fnw-backups/"
```

### Restoring

`scripts/restore.sh` puts one part of a backup back: `db`, `media` or `stats`. Decrypt on your
own machine, where the private key is, and pipe the stream to the VPS, so the key never goes on
the server and nothing is written there in the clear:

```sh
# On your own machine, with the backup files and the private key; the stack is in /srv/fnw.
age -d -i fnw-backup-key.txt db-<stamp>.dump.age \
  | ssh vps 'cd /srv/fnw && ./scripts/restore.sh db'
age -d -i fnw-backup-key.txt media-<stamp>.tar.gz.age \
  | ssh vps 'cd /srv/fnw && ./scripts/restore.sh media'
# With statistics:
age -d -i fnw-backup-key.txt umami-<stamp>.dump.age \
  | ssh vps 'cd /srv/fnw && ./scripts/restore.sh stats'
```

The database goes into a scratch database first, while the site keeps running, in one
transaction that stops at the first error: a damaged or wrong file fails there and the site stays
as it was. Only a complete copy replaces the live database (kept as `<name>_before_restore` until
the next restore); the site is down for the moment of the swap. Then the stack starts on the
image `.env` names, which applies that version's migrations to the restored data: restore onto
the version the backup was taken with, or a newer one, never an older one.

On a new VPS, install as above (steps 1 to 4 with the same `PAYLOAD_SECRET`, which signs the
editors' sessions and derives the form's keys) and restore before creating an admin: the
restored database brings its own accounts.

### Upgrading

```sh
./scripts/backup.sh                     # a backup of the site as it is now
# load the new image as in step 2, then in .env: APP_IMAGE=fromnowhere-web:<new version>
docker compose up -d                    # the app restarts and applies the new migrations
docker compose ps                       # the app "healthy"; if not: docker compose logs app
```

**Undoing a release** is restoring the backup taken before it on the image it was taken with:
set `APP_IMAGE` back to the previous version, then restore `db` (and `media`) as above. A
migration cannot be rolled back on its own (`AGENTS.md`, "Migrations").

**From 0.1.3 or earlier to 0.1.4**, once: 0.1.4 logs the app in as its own role instead of the
database superuser. With the 0.1.4 files and image in place, add `APP_DB_PASSWORD` to `.env`
(`openssl rand -hex 32`), then hand the database to the new role before the app starts:

```sh
docker compose stop caddy app
docker compose up -d db                                         # passes the password on
docker compose exec db sh /docker-entrypoint-initdb.d/00-app.sh  # safe to repeat
docker compose up -d
```
