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

| Concern  | Choice                                                                                                                                                                                                                                                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime  | Node **26** (`.nvmrc`), pnpm **12.20.0** pinned by `packageManager`, enforced by `pnpm-workspace.yaml` (`pmOnFail: error`, `engineStrict`, `strictDepBuilds`, a three-day `minimumReleaseAge`)                                                                                                       |
| App      | Next.js 16 (App Router, RSC, Server Actions), React 19, `output: 'standalone'`                                                                                                                                                                                                                       |
| CMS      | Payload 3 in the same app: editor at `/admin`, REST at `/api`. **GraphQL is off**                                                                                                                                                                                                                    |
| Database | PostgreSQL 17 (`@payloadcms/db-postgres`)                                                                                                                                                                                                                                                            |
| i18n     | `next-intl` 4 with `[locale]` routing (en main, hr), `messages/*.json`; Payload `localization` (en, hr) and a bilingual admin                                                                                                                                                                        |
| Styling  | The **Fromnowhere design system**: `design/` (README, patterns, motion, logo, tokens) and `src/styles/fnw/` (`tokens.css`, `bundle.css`), copied as fnwygo does; over it the site's **Night transit** layer in `src/app/(frontend)/[locale]/` (`site.css`, `routemap.css`, `board.css`). No Tailwind |
| Mail     | Contact form: its own `nodemailer` relay over `CONTACT_SMTP_*`. Admin mail: `SMTP_*`                                                                                                                                                                                                                 |
| Spam     | `altcha` + `altcha-lib` (self-hosted proof of work), honeypot, rate limit, signed fill-in time (`src/lib/relay/`)                                                                                                                                                                                    |
| Tests    | Vitest 5 (`tests/int`, against a real Postgres), Playwright (`tests/e2e`, not in CI)                                                                                                                                                                                                                 |
| Deploy   | `Dockerfile` (built in CI, never on the server), `compose.yml` (+ `compose.stats.yml`), `caddy/` (+ `caddy/sites/` for the other sites on the server), `scripts/` (first admin, age-encrypted backups, restore)                                                                                      |

Layout: `src/payload.config.ts` wires everything; `src/collections/` (Projects, Pages,
ShortLinks, Media, Users), `src/globals/Studio.ts`, `src/fields/`, `src/components/` (`fnw.tsx`
the system's components, `site/` the site's chrome, map, board and signs, with `HomeMotion.tsx`
the home page's one motion island, `contact/` the form, `admin/`), `src/lib/` (`links.ts` the link
rule, `payload.ts` every query, `routeMap.ts` the map's geometry, `shortLinks.ts`, `relay/`),
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

The end-to-end tests run the same way, never against the development database or the dev server
on :3000: `E2E_PORT` switches `playwright.config.ts` to a production server (`next start`) on
that port, against the `DATABASE_URL` given in the shell (migrations, then the seed), with uploads
in a temporary `MEDIA_DIR`. Build first; `next dev` holds `.next/dev/lock`, so a second dev server
cannot run beside yours, but a build can. The specs that attach test pictures boot Payload in
the test process; in this mode the config sets `PAYLOAD_MIGRATING` so it never pushes the
schema (a pushed database would stop the next `next start` at Payload's "data loss" prompt),
and a database can be reused for another run.

```sh
pnpm build
podman run -d --rm --name fnw-e2e-pg --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=test -p 54330:5432 postgres:17-alpine
E2E_PORT=3100 DATABASE_URL=postgres://postgres:test@localhost:54330/postgres pnpm test:e2e
podman rm -f -v fnw-e2e-pg
rm -rf "${TMPDIR:-/tmp}/fnw-e2e-media"
```

`tests/e2e/visual.e2e.spec.ts` writes screenshots to `test-results/night/` (or `VISUAL_DIR`)
for looking at by eye beside `docs/prototypes/night-transit.html`; it asserts nothing about
pixels.

## 4. Rules

### Design

- **The direction is Night transit**: the studio is a transit station at night. The approved
  prototype is [`docs/prototypes/night-transit.html`](docs/prototypes/night-transit.html); open
  it beside the site before UI work. It is built on the design system (`design/`,
  `src/styles/fnw/`: its components, spacing, type and motion tokens still apply) with the
  site's own layer over it: `site.css` (the night palette, the sky, the chrome, the pages),
  `routemap.css` (the map), `board.css` (the departures board, status, the ticker). Every colour,
  size and duration is a token; add one to `site.css`'s `:root` rather than a raw value. Its
  signature pieces: the headline whose full stop is the point, the route map, the board with the
  visitor's clock, the ticker of short links, lit terminals, windows.
- **The palette** (`site.css`, over the system's tokens so its fields and alerts take it too):
  `--night` (the page), `--ground`, `--surface`, `--surface-2`, `--track` (the casing under
  every line), `--text`, `--text-muted`, `--text-dim` (small mono labels, 4.5:1), `--accent`
  (the point, violet), `--sodium` (street light: the clock, work lights, the ticker),
  `--train-core`, `--running`, `--building`. The sky (`.sky`, in `[locale]/layout.tsx`, behind
  every page): a faint grid, a violet haze and a sodium glow from below.
- **Each line has its own colour**, from its line number through six tokens, `--line-1` …
  `--line-6`, repeating after six (`lineColour` in `src/lib/routeMap.ts`; no schema field). It is
  set as `--c` on everything of that line: its map line, terminal and trains, its board row, and
  its project page (kicker point, trip, exits).
- **Dark only.** `color-scheme: dark` and `viewport.colorScheme`; there is no light theme and
  nothing switches one.
- **Light, not paint.** Glows, halos and lit edges show what is lit (a line, a terminal, the
  point, the clock); solid fills stay on small marks (a line number, a terminal's core). Status
  is an icon, a word and a sub-label ("Running · Departs every visit"), never colour alone.
  Inter 400 and 500 only, no italics; JetBrains Mono (self-hosted in `public/fonts/`, OFL in
  `src/assets/fonts/`) for labels, numbers, addresses and the clock. Layouts left-aligned, never
  a centred hero.
- **Loud destinations stay in their windows.** Another project's own colours, type or imagery
  appear only inside its window on its project page; line colours are the station's.
- **The route map** (`src/lib/routeMap.ts`, `src/components/site/RouteMap.tsx`, `routemap.css`)
  is rendered whole by the server, both layouts (wide, and tall for a phone below 700px of map
  width, chosen by a container query), for 1 to 12 lines (`MAP.maxLines`; with more there is no
  map and the board lists them all; past six, cards drop their summary). The drawing is
  `aria-hidden`; each terminal's card is one link to the project's page here, named "Line 02,
  Giogio, Running", and the whole card is its target. The board is the accessible list.
- **Motion** (every animation is declared inside `@media (prefers-reduced-motion:
no-preference)`, which `tests/int/routeMap.int.spec.ts` checks for all three stylesheets):
  - **The home page's opening plays on every visit** (a load, a soft navigation back, the other
    language): CSS on the map's insertion, under `.map:not(.is-settled)`, never keyed on
    `fnw-calm`. The point appears, lines draw out of it one after another, each terminal lights
    and pulses, its card slides in. `HomeMotion` marks the map settled afterwards, so a layout
    that appears on resize does not draw again.
  - **Ambient motion always runs**: trains (one Web Animation each, set off once their line is
    drawn, a pulse at the terminal on each arrival, creeping up to the frontier on a line under
    construction), the point's rings, work lights, the ticker, the contact band's moving point,
    the drifting haze, the clock's colons. Trains pause while the tab is hidden or the map is
    off screen.
  - **Lighting**: pointing at or focusing a line, a terminal or a board row lights that line on
    the map and the board, dims the others and speeds its trains up (`HomeMotion`).
  - **Reduced motion**: everything is static and fully drawn; no trains, pulses, ticker or haze
    (the ticker wraps instead). The clock still ticks.
  - **Progressive enhancement**: without JavaScript the map, board and ticker are all there and
    every link works; `HomeMotion` only adds. No per-frame loop. The clock shows only with
    JavaScript (the server cannot know the visitor's time).
  - Other pages keep the system's `.fnw-enter` / `.fnw-reveal`, played by
    `src/components/Motion.tsx` once per page per visit (`fnw-calm`, `playedKey`: a page counts
    as played in both languages); a project page's trip draws on each load.
  - Transforms, opacity and stroke dashes only. No counting numbers, typewriter or split-flap.
- **Accessibility holds the design**: a visible 2px focus ring (`--focus`), every control at
  least 44px tall, no sideways scroll at 320px, the page centred. The map is never read twice:
  its drawing, stop labels and card details are `aria-hidden`, its links stay focusable.
- **Page transitions**: in this App Router site a soft navigation animates only through React's
  `<ViewTransition>` (`src/components/site/PageTransition.tsx`, keyed on the pathname around
  `.site-page`); CSS `@view-transition` (`transition.css`) covers full document loads only. The
  header is held still; only the page box crossfades, and nothing animates under reduced motion.
  On Next 16.4 / React 19.3, EN↔HR swaps at once (the `[locale]` root layout remounts from
  `<html>` down, and React fires no boundary inside a DOM node it inserts), and so does
  back/forward (React flushes a popstate transition synchronously, with the sync lane, and
  animates only pure transition commits). Focus still moves in both.
- **Focus after a soft navigation** moves to `<main id="content" tabindex="-1">` whenever the
  pathname changes, so the next Tab starts inside the new page; after a full load it starts at
  the document. `#content` takes focus without an outline: it is a target, not a control.
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
  absolute `https:`/`mailto:`/`tel:` address; checked by shape at save time (`src/fields/link.ts`)
  and again at render (`resolveLink`). Project addresses and profiles are https only
  (`httpsRule`).
- **Short links** are one word at the root (`fromnowhere.dev/giogio`), answered in
  `pick-language`; `isShortAlias` keeps the languages and the paths the site answers itself out.
  A short link and a page never share a word (both refused at save time), and pick-language
  prefers the page.
- **Nothing is invented for a visitor.** An empty field renders nothing; links to About and
  Privacy appear only while those pages are published; the form shows only while it can send.
  The tally is counted from the published projects, the ticker lists the short links that lead
  somewhere public (`getShortLinks`), and the board's sub-labels say what a status means ("Departs
  every visit", "Not in service yet"), never a time or a latency.
- **Windows** (`src/components/site/Window.tsx`) are a real, still capture of a destination's
  published first screen on a phone (4:5), taken with `pnpm capture:windows` and listed in
  `src/seed/windowSeeds.ts`. Never a demo, seed data, a preview, an iframe or a hand-made
  postcard, never someone's personal details, and for a client site only with the client's
  agreement. No honest capture, no window: none is seeded yet. Tests attach a fixture picture
  (`tests/helpers/fixtureWindow.ts`) in a throwaway database only.

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
2. **Scaffold and the still page:** the NMT-PublicWeb base, the design system, Projects / Pages /
   Short links / Studio, home with the board, project pages with exit plates, text pages,
   contact, share cards, sitemap, seed.
3. **Done (Phase 1, [`docs/phase-1.md`](docs/phase-1.md)):** the route map on the home page
   (point, lines, plates, hover lighting a line, dashed lines under construction, drawn once per
   visit), the windows' plumbing (frame, `windowAddress`, capture script, seed; no window seeded
   until a destination is published), and the page transition with focus on `#content`.
   **Night transit** (16 November 2026, [`docs/prototypes/night-transit.html`](docs/prototypes/night-transit.html))
   replaced the still look: dark only, line colours, the map drawn and run with trains, the
   departures board with the clock and the ticker; `docs/phase-1.md`'s map, rail, plates and
   once-per-visit draw are history.
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
- **Dark only, and the head script**: there is no theme to set. The head script (`headScript` in
  `src/lib/motion.ts`, rendered by `[locale]/layout.tsx`) only decides, before paint, whether the
  other pages' entrances play (`fnw-calm`); the home page's opening ignores it.
- **The sky shows through `<body>`**: the page's colour is on `<html>` and `body` is transparent,
  or the body's own background would cover the `z-index: -1` sky (as it did in the prototype).
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
