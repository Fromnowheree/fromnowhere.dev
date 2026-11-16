# AGENTS.md — fromnowhere.dev

Guidance for anyone, human or agent, working in this repository. Read it first.

## 1. What this is

**fromnowhere.dev**, the Fromnowhere studio site: the crossroad to the projects. One point (the
point in the FNW mark), one line per project, a departures board, a page per project with exit
plates and a window onto the destination, About, Privacy and a contact form, in English and
Croatian. The vision, with the concept, pages, content model, stack and build order, is
[`docs/vision.html`](docs/vision.html) (published at
https://claude.ai/artifact/5Y2Cxdt9jEJv9pzCXxGYYM). Read it before changing what the site is.

The projects it links to live elsewhere: yugioh.fromnowhere.dev (fnwygo), giogio.music (giogio),
medical.fromnowhere.dev (NMT's showcase, not built yet), gati.hr (Gati). This site never talks to
them; it only links.

It was started on 16 November 2026 from a copy of NMT-PublicWeb's committed files: its
infrastructure, security hardening, language routing, contact relay and tests were kept; the
clinic layer (blocks, services, team, locations, brand colour, Tailwind, booking) was removed.

## 2. Stack (check package.json before trusting prose)

| Concern  | Choice                                                                                                                                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime  | Node **26** (`.nvmrc`), pnpm **12.20.0** pinned by `packageManager`, enforced by `pnpm-workspace.yaml` (`pmOnFail: error`, `engineStrict`, `strictDepBuilds`, a three-day `minimumReleaseAge`)                                               |
| App      | Next.js 16 (App Router, RSC, Server Actions), React 19, `output: 'standalone'`                                                                                                                                                               |
| CMS      | Payload 3 in the same app: editor at `/admin`, REST at `/api`. **GraphQL is off**                                                                                                                                                            |
| Database | PostgreSQL 17 (`@payloadcms/db-postgres`)                                                                                                                                                                                                    |
| i18n     | `next-intl` 4 with `[locale]` routing (en main, hr), `messages/*.json`; Payload `localization` (en, hr) and a bilingual admin                                                                                                                |
| Styling  | The **Fromnowhere design system**: `design/` (README, patterns, motion, logo, tokens) and `src/styles/fnw/` (`tokens.css`, `bundle.css`), copied as fnwygo does; the site's own layer in `src/app/(frontend)/[locale]/site.css`. No Tailwind |
| Mail     | Contact form: its own `nodemailer` relay over `CONTACT_SMTP_*`. Admin mail: `SMTP_*`                                                                                                                                                         |
| Spam     | `altcha` + `altcha-lib` (self-hosted proof of work), honeypot, rate limit, signed fill-in time (`src/lib/relay/`)                                                                                                                            |
| Tests    | Vitest 5 (`tests/int`, against a real Postgres), Playwright (`tests/e2e`, not in CI)                                                                                                                                                         |
| Deploy   | `Dockerfile` (built in CI, never on the server), `compose.yml` (+ `compose.stats.yml`), `caddy/` (+ `caddy/sites/` for the other sites on the server), `scripts/` (first admin, age-encrypted backups, restore)                              |

Layout: `src/payload.config.ts` wires everything; `src/collections/` (Projects, Pages,
ShortLinks, Media, Users), `src/globals/Studio.ts`, `src/fields/`, `src/components/` (`fnw.tsx`
the system's components, `site/` the site's chrome and signs, `contact/` the form, `admin/`),
`src/lib/` (`links.ts` the link rule, `payload.ts` every query, `shortLinks.ts`, `relay/`),
`src/i18n/`, `src/proxy.ts`, `src/app/(frontend)/[locale]/(site)/` (home `page.tsx`,
`projects/[slug]`, `contact`, `[slug]` for text pages), `src/app/(frontend)/pick-language/`
(addresses without a language, and short links), `src/app/(frontend)/og/` (share cards),
`src/seed/` (the starting content). `src/payload-types.ts` and
`src/app/(payload)/admin/importMap.js` are generated; never edit them by hand.

## 3. Commands

```sh
pnpm install
podman compose -f compose.dev.yml up -d   # a development Postgres on :5432
pnpm dev                                  # http://localhost:3000, editor at /admin

pnpm generate:types        # after ANY schema change
pnpm generate:importmap    # after adding or renaming an admin component
pnpm lint
pnpm typecheck
pnpm test:int              # Vitest; boots Payload against DATABASE_URL; needs `age` on PATH
pnpm build
```

A test database is always a throwaway container, removed with its volume:

```sh
podman run -d --rm --name fnw-test-pg --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=test -p 54329:5432 postgres:17-alpine
DATABASE_URL=postgres://postgres:test@localhost:54329/postgres pnpm test:int
podman rm -f -v fnw-test-pg
```

## 4. Rules

### Design

- **The studio site never steps outside the design system** (unlike fnwygo's broadcast look,
  which was a deliberate exception): every colour, size, space, radius, duration and easing is a
  token (`var(--surface)`, `var(--space-4)`, `var(--duration-slow)`). Read `design/README.md`,
  `design/patterns.md` ("Studio and portfolio") and `design/motion.md` before UI work. Its
  uniqueness comes from wayfinding built out of the mark: the route map, the board, exit plates,
  windows (vision, "Signature pieces").
- **A quiet station, loud destinations.** Another project's colours, type or imagery appear only
  inside a framed window on its project page, never in the site's chrome.
- **The accent is a line, a point or a glow, never a flood.** Status is an icon and a word, never
  colour alone. Inter 400 and 500 only, no italics. Layouts left-aligned, never a centred hero.
- **Motion** uses the system's `.fnw-enter` / `.fnw-reveal` (played by `src/components/Motion.tsx`
  once per page per visit) and the motion tokens; `transform` and `opacity` only; everything stops
  under `prefers-reduced-motion`. No counting numbers, typewriter or split-flap effects.
- **Voice**: plain, short, sentence case, no exclamation marks, no emoji. The studio speaks as
  "I", never "we". The name is **Fromnowhere** (one word), the monogram **FNW**.

### Content and links

- **Every interface string is in `messages/en.json` and `messages/hr.json`**, never in a
  component, with identical key trees (`tests/int/messages.int.spec.ts`). Keys are typed against
  English (`src/i18n/global.d.ts`).
- **Every public address carries its language, and the rest of it is the same in both**
  (`/en/projects/giogio`, `/hr/projects/giogio`). Link with `Link` from `src/i18n/navigation.ts`,
  never `next/link` (the 404's home link is the one commented exception).
- **Content is localised field by field**: what a visitor reads is `localized: true`; names,
  slugs, numbers, addresses and settings are not. Payload falls back to English.
- **Every query of projects and pages names `_status: published`** (`src/lib/payload.ts`): the
  Local API skips access control. A draft project is how a project is hidden (mtnet.hr waits as
  one).
- **Every authored link follows one rule** (`src/lib/links.ts`): a site path without its
  language that names something public (`/`, `/contact`, `/<page>`, `/projects/<slug>`), or an
  absolute `https:`/`mailto:`/`tel:` address; checked at save time (`src/fields/link.ts`) and
  again at render (`resolveLink`). Project addresses and profiles are https only (`httpsRule`).
- **Short links** are one word at the root (`fromnowhere.dev/giogio`), answered in
  `pick-language`; `isShortAlias` keeps the languages and the paths the site answers itself out.
- **Nothing is invented for a visitor.** An empty field renders nothing; links to About and
  Privacy appear only while those pages are published; the form shows only while it can send.

### Security (inherited from NMT-PublicWeb; keep them)

- **The contact form is a relay and nothing else** (`src/components/contact/actions.ts`,
  `src/lib/relay/`): no collection, no file, no queue, and nothing the visitor wrote in any log
  line. "Sent" only once the mail server accepted the message. Checks run cheapest first, proof
  of work last. It sends only through its own send-only account, never Payload's mail adapter.
- **The rate limit keys on the LAST `X-Forwarded-For` entry**, the one Caddy appends
  (`src/lib/rateLimit.ts`), an IPv6 address by its /64. `compose.yml` enables IPv6 so visitors
  keep their addresses (README, "Visitors' addresses").
- **The editor's sign-in is limited per address** (`src/lib/authLimits.ts`, Users hook).
- **The session cookie counts only from the site's own origin** (`csrf`,
  `src/lib/siteOrigins.ts`); never empty that list. **Cookies stay host-only**: never set
  `auth.cookies.domain`, or the cookie would reach every *.fromnowhere.dev site.
- **The first admin is made at provisioning** (`scripts/create-admin.sh`, `src/lib/provision.ts`),
  never by whoever opens `/admin` first; Caddy answers `/api/users/first-register` with 404.
- **Every response carries a Content-Security-Policy** (`next.config.ts`); uploads get one of
  their own that keeps `script-src 'none'`.
- **GraphQL stays off** and there are no route files under `src/app/(payload)/api/graphql*`.
- **The app container gets only the variables it reads**, listed in `compose.yml`; a new one
  goes into `.env.example` AND that list (`tests/int/deploy.int.spec.ts`).
- **The app logs in to Postgres as its own role, `app`** (`db/init/app-role.psql`), never the
  superuser.
- **Nothing is built on the server.** The image is non-root and runs read-only with
  `cap_drop: [ALL]`; it writes only to `/app/media` and `/app/.next/cache`.
- **Backups are encrypted or not written** (`scripts/backup.sh`, age), and a restore changes
  nothing until it is complete (`scripts/restore.sh`).

## 5. Migrations (read before deploying anything)

Development pushes the schema; **production never pushes**: it applies `src/migrations/` at
server start (`src/instrumentation.ts`), and exits if that fails so the container restarts.
**Every schema change ships with its own migration**: change the config, `pnpm generate:types`,
`pnpm payload migrate:create <name>`, commit the `.ts`, its `.json` snapshot and `index.ts`. CI
fails a schema change without them. Migrations are append-only once production has run them.

The baseline's `down()` throws on purpose: generated, it dropped every table. Undoing a release
is restoring the backup taken before it.

A select field's enum is named after the field, and drafts already own `enum_<collection>_status`
for `_status`: a select named `status` on a collection with drafts needs its own `enumName`
(Projects has `enum_projects_line_status`), or the first push fails with "invalid input value
for enum".

## 6. Build order (from the vision)

1. Vision agreed (16 November 2026).
2. **Scaffold and the still page (this commit):** the NMT-PublicWeb base, the design system,
   Projects / Pages / Short links / Studio, home with the board, project pages with exit plates,
   text pages, contact, share cards, sitemap, seed.
3. The route map on the home page (point, lines, plates, hover lighting a line, dashed lines
   under construction, drawn once per visit), the windows, and the page transition.
4. The status check (a Payload job pinging each address every 5 minutes; the board shows real
   status) and share cards with the project's line lit.
5. About text, Caddy and DNS for fromnowhere.dev, the shared Caddy for the other sites, launch.

## 7. Gotchas

- **Never add a `loading.tsx`** (or a `<Suspense>` above a page) under
  `src/app/(frontend)/[locale]/`: streaming sends 200 before the page knows it exists, so an
  unpublished page would answer 200 instead of 404.
- **`next dev` rewrites the block below** in this file. Leave it in place and commit it.
- **Pages render per request** (`dynamic = 'force-dynamic'`), so the image builds without a
  database and edits show at once.
- **Share cards** read `src/assets/fonts/Inter-Regular.ttf` (Satori takes TTF, not WOFF2);
  `next.config.ts` traces it into the standalone build.
- **The theme**: dark is primary; `[locale]/layout.tsx`'s head script switches `data-theme` to
  light when the device asks for it, before paint, and decides whether entrances play.
- **Seeding the second language of an array** needs the row ids of the first, or Payload replaces
  the rows (`src/seed/index.ts`).
- **A test that needs an empty install** uses its own database (`tests/helpers/freshDatabase.ts`).
- **To see the form locally** set the six `CONTACT_*` variables; without them the contact page
  shows the e-mail address instead. The relay insists on TLS.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
