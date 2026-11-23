# Launching fromnowhere.dev

The runbook for Phase 3: one Oracle Cloud server (Always Free, Ampere A1, arm64) running
fromnowhere.dev and yugioh.fromnowhere.dev behind one Caddy. Each step says where it runs:
**[you]** on your own machine or in a web console, **[server]** over ssh. The README's
"Installing on a VPS" is the general version of the same; this one is the concrete order.

```
            ┌──────────────── the server ────────────────────────────────────────┐
 :80/:443 → │ fnw caddy ──(fnw default net)── fnw app ── fnw db                  │
            │     └──────(fromnowhere-sites)── ygo-web ──(fnwygo net)── ygo db    │
            │                                               └── ygo bot           │
            └────────────────────────────────────────────────────────────────────┘
```

Only the two Caddy-facing containers share a network. Neither app can reach the other's
database.

## 0. Before you start [you]

- An Oracle Cloud account (Always Free), an ssh key pair.
- Access to the DNS of fromnowhere.dev.
- A mail provider for fromnowhere.dev that gives you two mailboxes: **hello@fromnowhere.dev**
  (where messages arrive, read by you) and a **send-only** one for the site, e.g.
  **website@fromnowhere.dev**, with SMTP on port 587 (STARTTLS) or 465. Oracle blocks outbound
  port 25; 587 and 465 are open.
- An age key pair for backups, made on your machine: `age-keygen -o fnw-backup-key.txt`. The
  private key never goes on the server.

## 1. The server [you]

First, **upgrade the account to Pay As You Go** (Billing → Upgrade). Resources inside the Always
Free limits stay free, but Oracle reclaims _idle_ Always Free instances on free-only accounts, and
a quiet portfolio site looks idle. Set a budget alert at a small amount while you are there.

Then Oracle Cloud console → Compute → Instances → Create:

- **Image**: Canonical Ubuntu 24.04 (the aarch64 build is picked with the shape).
- **Shape**: Ampere → `VM.Standard.A1.Flex`, **2 OCPUs / 12 GB**: plenty for both sites, and
  within the Always Free Ampere allowance (reported as halved in 2026 from 4 / 24; check the
  current limit on Oracle's Always Free page). If it says "out of capacity", try another
  availability domain or try again later; it comes and goes.
- **Boot volume**: 100 GB (Always Free covers 200 GB of block storage in total).
- **Networking**: a public subnet with a public IPv4 address. IPv6 is optional: enable it on the
  VCN and the subnet, assign an address to the instance, and add AAAA records in step 3.
- **SSH key**: your public key.

Then open the ports, in two places:

1. **The subnet's security list** (Networking → VCN → Security Lists → Default): add ingress rules
   from `0.0.0.0/0` (and `::/0` with IPv6) for **TCP 80**, **TCP 443** and **UDP 443**. Leave
   22 as it is, or narrow it to your own address.
2. **The server's own firewall** [server]. Oracle's Ubuntu image ships iptables rules that reject
   everything but ssh. Docker's published ports pass through Docker's own chains, but open them
   explicitly so nothing depends on that:

   ```sh
   sudo iptables -I INPUT -p tcp -m multiport --dports 80,443 -m conntrack --ctstate NEW -j ACCEPT
   sudo iptables -I INPUT -p udp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```

   Do this before Docker is installed, and never run `netfilter-persistent save` again once it
   is: it would save Docker's own chains too, and after a reboot they would clash with the ones
   Docker makes, cutting the containers off.

## 2. Docker and the basics [server]

```sh
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y ca-certificates curl git age unattended-upgrades
# Docker Engine and the compose plugin from Docker's own repository (arm64 is supported):
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"     # takes effect at the next login; `sudo docker` until then
sudo dpkg-reconfigure -plow unattended-upgrades
sudo docker network create fromnowhere-sites
sudo mkdir -p /srv/fnw /srv/fnwygo && sudo chown "$USER" /srv/fnw /srv/fnwygo
exit                                # log in again, so `docker` works without sudo
```

## 3. DNS [you]

At the DNS host of fromnowhere.dev, with the server's IPv4 address (and IPv6 if it has one):

| Name                     | Type         | Value                    |
| ------------------------ | ------------ | ------------------------ |
| `fromnowhere.dev`        | A (AAAA)     | the server               |
| `www.fromnowhere.dev`    | A (AAAA)     | the server               |
| `yugioh.fromnowhere.dev` | A (AAAA)     | the server               |
| `fromnowhere.dev`        | MX, TXT, ... | what the mail provider says (MX, SPF, DKIM, DMARC) |

`.dev` is HTTPS only in every browser; Caddy gets the certificates itself once the names point
at the server and ports 80 and 443 are open. Check with `dig +short fromnowhere.dev` before step 6.

## 4. The image [you]

The server never builds this site. On your machine, with everything committed (the script
refuses a tree with changes):

```sh
git tag v0.1.0                           # the release: package.json's version, with a v
./scripts/build-image.sh                 # linux/arm64, under emulation: slow, give it time
podman save localhost/fromnowhere-web:0.1.0 | ssh <server> docker load    # or docker save
```

The name keeps its `localhost/` prefix: that is what podman calls a local image, and `.env`
names it the same way. Compose never pulls it (`pull_policy: never`), so a name that does not
match stops with a clear error.

## 5. The checkout and `.env` [server]

The server needs the release's deployment files (compose, Caddy, db init, scripts), not the
source, and no Git remote is needed: send the tag's tree from your machine.

```sh
git archive v0.1.0 | ssh <server> 'tar -x -C /srv/fnw'          # [you]
cd /srv/fnw && cp .env.example .env && chmod 600 .env          # [server]
```

Fill in `.env` (every variable is explained in `.env.example`):

```sh
COMPOSE_FILE=compose.yml:compose.shared.yml
APP_IMAGE=localhost/fromnowhere-web:0.1.0
SITE_DOMAIN=fromnowhere.dev
SITE_URL=https://fromnowhere.dev
ADMIN_ALLOW=...              # your own address: curl -4 ifconfig.me (and -6); space-separated
POSTGRES_USER=fnw
POSTGRES_DB=fnw
POSTGRES_PASSWORD=...        # openssl rand -hex 32
APP_DB_PASSWORD=...          # openssl rand -hex 32
PAYLOAD_SECRET=...           # openssl rand -hex 32; final once live
PAYLOAD_SEED=true            # first start only
ADMIN_EMAIL=...              # your own address, for the first admin
STATUS_CHECKS=on
BACKUP_RECIPIENT=age1...     # the PUBLIC key from step 0
# The contact form: the send-only mailbox, to the inbox you read.
CONTACT_SMTP_HOST=...
CONTACT_SMTP_PORT=587
CONTACT_SMTP_USER=website@fromnowhere.dev
CONTACT_SMTP_PASS=...
CONTACT_FROM=website@fromnowhere.dev
CONTACT_TO=hello@fromnowhere.dev
# Admin mail (password resets), optional: a mailbox of its own, or leave empty (mail is logged).
```

## 6. Start fromnowhere.dev [server]

```sh
docker compose up -d
docker compose logs -f app caddy     # migrations, the seed, then the certificates
```

Once `https://fromnowhere.dev` answers, set `PAYLOAD_SEED=false` in `.env` and run
`docker compose up -d` again (the seed never overwrites, but it has no reason to stay on).

Then the first admin: `./scripts/create-admin.sh` prints a password once (README, "The first
admin").

`/admin` (and the API it works through) answers only to the addresses in `ADMIN_ALLOW`; from
anywhere else it is a 404. When your address changes (a new connection, travel), set it again in
`.env` and run `docker compose up -d caddy`. For an IPv6 home network whose last part changes,
allow its prefix (e.g. `2001:db8:1234::/56`).

## 7. Content, before telling anyone [you, in /admin]

- **Projects**: a project whose address is not live yet goes to **Building** (or Planned), not
  Running, or the status check shows it as Delayed. Locals and Giogio are seeded as Building:
  Locals stays so until step 8, Giogio until giogio.music answers. Until then the board says
  "No answer" beside each of their addresses.
- **Studio**: the e-mail is seeded as hello@fromnowhere.dev; add profiles if you want them.
- **About**: a draft in both languages; make it yours.
- **Privacy**: a starting text that matches what the site does; read it, and add who is
  responsible for the site (your name or business) if the law where you work asks for it.
- **Settings → Status checks**: rows appear within 5 minutes, one per address.

## 8. yugioh.fromnowhere.dev beside it [server]

```sh
# [you] from the fnwygo checkout (it builds on the server, so it needs its source):
#   git archive HEAD | ssh <server> 'tar -x -C /srv/fnwygo'
cd /srv/fnwygo
cp /srv/fnw/deploy/fnwygo/compose.shared.yml .
cp .env.example .env && chmod 600 .env     # fill in as fnwygo's README says, plus:
#   COMPOSE_FILE=compose.yml:compose.shared.yml
#   SITE_URL=https://yugioh.fromnowhere.dev
docker compose up -d --build               # no --profile https: fnw's Caddy is the front door
cd /srv/fnw
cp caddy/sites/yugioh.caddy.example caddy/sites/yugioh.caddy
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

fnwygo builds on the server, as its own README does; the A1 shape has the memory for it. Once
`https://yugioh.fromnowhere.dev` answers, set Locals to Running in fromnowhere.dev's admin.

## 9. Backups [server]

```sh
crontab -e
# 30 3 * * * cd /srv/fnw && ./scripts/backup.sh 2>&1 | logger -t fnw-backup
./scripts/backup.sh && ls backups/
```

And copy them off the server from your machine (README, "Backups"). fnwygo has its own
database: back it up by its own README.

## 10. Smoke test [you]

```sh
curl -sI https://fromnowhere.dev/en | grep -iE '^(HTTP|strict-transport|content-security)'
curl -sI https://www.fromnowhere.dev | grep -i '^location'          # → https://fromnowhere.dev/
curl -sI https://fromnowhere.dev/ygo | grep -i '^location'          # the short link
curl -so /dev/null -w '%{http_code}\n' https://fromnowhere.dev/api/users/first-register   # 404
# From a phone on mobile data (not your ADMIN_ALLOW address): /admin answers 404.
curl -so /dev/null -w '%{http_code} %{content_type}\n' https://fromnowhere.dev/og/en/projects/giogio
```

In a browser: the home page's opening plays, the board shows each line's real status, EN ↔ HR
keeps the page, the contact form sends a message that arrives at hello@fromnowhere.dev with
Reply-To set to the sender, and a link pasted into a chat shows the share card.

## 11. Every release after this [you, then server]

```sh
# [you] the version first: the image is named after package.json's version.
npm pkg set version=0.1.1 && git commit -am "Release 0.1.1" && git tag v0.1.1
./scripts/build-image.sh
podman save localhost/fromnowhere-web:0.1.1 | ssh <server> docker load
git archive v0.1.1 | ssh <server> 'tar -x -C /srv/fnw'     # the release's compose, Caddy, scripts
# [server]
cd /srv/fnw && ./scripts/backup.sh          # the way back is this backup (AGENTS.md §5)
sed -i 's#^APP_IMAGE=.*#APP_IMAGE=localhost/fromnowhere-web:0.1.1#' .env
docker compose up -d                        # migrations run at start
docker compose up -d --force-recreate caddy # Caddy reads a changed Caddyfile only when recreated
```

The Caddyfile is mounted as a single file: an unpacked release replaces the file on disk, and a
running Caddy keeps reading the old one (even through `caddy reload`) until it is recreated.
Its certificates are kept in its volume, so recreating it costs a second, not a certificate.
