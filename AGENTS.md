# AGENTS.md — fromnowhere.dev

Guidance for anyone, human or agent, working in this repository. Read it first.

## 1. What this is

**fromnowhere.dev**, the Fromnowhere studio's front page: what the studio can be hired for, shown
through the work. One point (the point in the FNW mark), one line per project, a departures board,
the services (each with the lines it runs on), the capabilities (the engineering under every
line), a case study per project with exit plates and a window onto the destination, dated notes,
About, Privacy and a contact form, in English and Croatian. The vision, with the concept, pages,
content model, stack and build order, is [`docs/vision.html`](docs/vision.html) (published at
https://claude.ai/artifact/5Y2Cxdt9jEJv9pzCXxGYYM). Read it before changing what the site is.

**Who it is for** (decided 20 November 2026): clients with something to build. It began as a
crossroad to the projects and read as a portfolio; it is now the business's front page, and every
page should help a client decide to write. The studio never says how many people it is (see
"Voice").

The projects it links to live elsewhere: yugioh.fromnowhere.dev (fnwygo), giogio.music (giogio),
medical.fromnowhere.dev (NMT's showcase, not built yet), gati.hr (Gati). This site never talks to
them; it only links.

It was started on 16 November 2026 from a copy of NMT-PublicWeb's committed files: its
infrastructure, security hardening, language routing, contact relay and tests were kept; the
clinic layer (blocks, services, team, locations, brand colour, Tailwind, booking) was removed.

## 2. Stack (check package.json before trusting prose)

| Concern  | Choice                                                                                                                                                                                                                                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Runtime  | Node **26** (`.nvmrc`), pnpm **12.20.0** pinned by `packageManager`, enforced by `pnpm-workspace.yaml` (`pmOnFail: error`, `engineStrict`, `strictDepBuilds`, a three-day `minimumReleaseAge`)                                                                                                                                 |
| App      | Next.js 16 (App Router, RSC, Server Actions), React 19, `output: 'standalone'`                                                                                                                                                                                                                                                 |
| CMS      | Payload 3 in the same app: editor at `/admin`, REST at `/api`. **GraphQL is off**                                                                                                                                                                                                                                              |
| Database | PostgreSQL 17 (`@payloadcms/db-postgres`)                                                                                                                                                                                                                                                                                      |
| i18n     | `next-intl` 4 with `[locale]` routing (en main, hr), `messages/*.json`; Payload `localization` (en, hr) and a bilingual admin                                                                                                                                                                                                  |
| Styling  | The **Fromnowhere design system**: `design/` (README, patterns, motion, logo, tokens) and `src/styles/fnw/` (`tokens.css`, `bundle.css`), copied as fnwygo does; over it the site's **Night transit** layer in `src/app/(frontend)/[locale]/` (`site.css`, `routemap.css`, `board.css`, `notes.css`, `offer.css`). No Tailwind |
| Mail     | Contact form: its own `nodemailer` relay over `CONTACT_SMTP_*`. Admin mail: `SMTP_*`                                                                                                                                                                                                                                           |
| Spam     | `altcha` + `altcha-lib` (self-hosted proof of work), honeypot, rate limit, signed fill-in time (`src/lib/relay/`)                                                                                                                                                                                                              |
| Tests    | Vitest 5 (`tests/int`, against a real Postgres), Playwright (`tests/e2e`, not in CI)                                                                                                                                                                                                                                           |
| Deploy   | `Dockerfile` (built in CI, never on the server), `compose.yml` (+ `compose.stats.yml`), `caddy/` (+ `caddy/sites/` for the other sites on the server), `scripts/` (first admin, age-encrypted backups, restore)                                                                                                                |

Layout: `src/payload.config.ts` wires everything; `src/collections/` (Projects, Services,
Capabilities, Notes, Pages, ShortLinks, StatusChecks, Media, Users), `src/jobs/` (the status check), `src/globals/Studio.ts`, `src/fields/`, `src/components/` (`fnw.tsx`
the system's components, `site/` the site's chrome, map, board and signs, with `HeroLines.tsx`
the hero's tracks, `StripMap.tsx` the home page's own stops and `HomeMotion.tsx` the home page's
one motion island, `Notes.tsx` the notes' log, panel and lists with
`NotesMotion.tsx` their train, `Offer.tsx` the services, capabilities and proof chips, `contact/`
the form, `admin/`), `src/lib/` (`links.ts` the link
rule, `payload.ts` every query, `routeMap.ts` the map's geometry, `status.ts` a line's live status, `probe.ts` one knock on an
address, `notes.ts` when the notes open, `shortLinks.ts`, `relay/`),
`src/i18n/`, `src/proxy.ts`, `src/app/(frontend)/[locale]/(site)/` (home `page.tsx`,
`projects/[slug]`, `services`, `capabilities`, `notes`, `notes/[slug]`, `contact`, `[slug]` for
text pages), `src/app/(frontend)/pick-language/`
(addresses without a language, and short links), `src/app/(frontend)/og/` (share cards), `src/app/llms.txt/` (the site for language models),
`src/app/.well-known/security.txt/`, `src/app/manifest.ts` (icons from `scripts/make-icons.mjs`),
`src/app/global-error.tsx` and the two `error.tsx` (the error page),
`src/seed/` (the starting content: `index.ts` the projects with their case studies, pages, notes
and the studio's words, `offer.ts` the services and capabilities). `src/payload-types.ts` and
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
  `routemap.css` (the map), `board.css` (the departures board, status, the ticker), `notes.css`
  (the notes, [`docs/prototypes/notes.html`](docs/prototypes/notes.html)), `offer.css` (the
  services, the capabilities, proof chips, the hero's actions, a case study's chapters). Every colour,
  size and duration is a token; add one to `site.css`'s `:root` rather than a raw value. Its
  signature pieces: the headline whose full stop is the point, the route map, the board with the
  visitor's clock, the ticker of short links, lit terminals, windows. **The home page gives each
  its own screen** (21 November 2026): the hero fills the first one (`--header-h`, less
  `--hero-peek`, the strip in which the map's title shows), and the route map is the next section,
  under its own title ("Route map") with the tally beside it. With no map (no projects, or more
  than twelve) the tally stays in the hero. The map's point is labelled "FNW Studio", and every
  section's small label begins with it ("FNW Studio · services"). **Behind the hero, tracks of
  light leave the headline's point** (`src/components/site/HeroLines.tsx`): a trunk to the right
  edge, two tracks peeling up and three down, at 0° and 45°, drawn in units of the headline's
  size (`--hero-fs`). They are decoration (`aria-hidden`) and always the point's violet, never a
  line's colour. Three boxes placed by CSS anchor positioning keep them clear of words (the trunk
  from the point, the tracks up from the headline's right edge, the tracks down from the lede's);
  a browser without anchor positioning shows none. **The way down the page** (21 November 2026):
  the page never takes the scroll away from the visitor. The map and the board are each a screen,
  so a scroll that ends near the head of the next one down settles on it (CSS scroll snap,
  `proximity`, armed by `HomeMotion` for the next screen only and let go once it is reached, so
  nothing ever pulls back); the bands under them are shorter or longer than a screen and never
  snap. At the window's left edge from 1024px, **the strip map** (`StripMap.tsx`): the page as a
  line of its own, one stop per section that is on the page, the point first, each a plain link
  to its section's id (`#map`, `#board`, `#services`, `#works`, `#notes`, `#start`; `#top` is
  the top). `HomeMotion` lights the stop the visitor is at (`aria-current="location"`), rides a
  train there, and makes a click's jump smooth. A stop's name shows when the strip is pointed at
  or focused with the keyboard. The offer wears the same signs:
  a **service** is a lettered roundel (A, B, C, by its place) with a short track for each
  line it runs on; a **capability** is a stop on a track under sodium work lights ("the works");
  **proof** is a chip per line in that line's colour, and the point for this site; a **case
  study** is chapters as stops down the project's own line.
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
no-preference)`, which `tests/int/routeMap.int.spec.ts` checks for site.css, routemap.css,
  board.css, notes.css and offer.css):
  - **The home page's opening plays on every visit** (a load, a soft navigation back, the other
    language): CSS on the map's insertion, under `.map:not(.is-settled)`, never keyed on
    `fnw-calm`. The point appears, lines draw out of it one after another, each terminal lights
    and pulses, its card slides in. The map is under the hero's screen, so `HomeMotion` starts
    the opening over and holds it at its first frame until the map comes into view (only while
    the map is still below the window; without JavaScript it plays as the page arrives).
    `HomeMotion` marks the map settled afterwards, so a layout that appears on resize does not
    draw again.
  - **The hero's tracks draw out of the headline's point as the page arrives** (CSS, on every
    visit), then short trains set out along them and a ring leaves the point now and then.
  - **Each section arrives as it comes into view**: the board's rows sweep in, and the bands
    under it (services, the works, notes, the contact band) rise in, head first, then each card.
    `HomeMotion` marks only what is still below the window (`is-pending`, then `is-arrived`), so
    nothing a visitor has seen is ever hidden.
  - **Ambient motion always runs**: trains (one Web Animation each, set off once their line is
    drawn, a pulse at the terminal on each arrival, creeping up to the frontier on a line under
    construction), the point's rings, work lights, the ticker, the contact band's moving point,
    the drifting haze, the clock's colons. Trains pause while the tab is hidden or the map is
    off screen.
  - **Lighting**: pointing at or focusing a line, a terminal or a board row lights that line on
    the map and the board, dims the others and speeds its trains up (`HomeMotion`).
  - **Reduced motion**: everything is static and fully drawn; no trains, pulses, ticker or haze
    (the ticker wraps instead), nothing settles, waits or rides. The clock still ticks, and the
    strip map still says where the visitor is.
  - **Progressive enhancement**: without JavaScript the map, board and ticker are all there and
    every link works; `HomeMotion` only adds. No per-frame loop. The clock shows only with
    JavaScript (the server cannot know the visitor's time).
  - Other pages keep the system's `.fnw-enter` / `.fnw-reveal`, played by
    `src/components/Motion.tsx` once per page per visit (`fnw-calm`, `playedKey`: a page counts
    as played in both languages); a project page's trip draws on each load, and so does the
    notes' rail, down which `NotesMotion` runs one train (Web Animations, paused off screen).
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
  **Fromnowhere** or "the studio" ("Fromnowhere builds…", "every message gets a reply"), never
  "I" and never "we", and **never says how many people it is**: no "one-person", "solo",
  "freelance", no team either. That holds for interface text, the seed, notes and anything
  written for the site later (`tests/int/voice.int.spec.ts` checks the messages and the seed in
  both languages; a visitor's own words, like the consent line, may say "I"). The name is
  **Fromnowhere** (one word), the monogram **FNW**.

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
  language that names something public (`/`, `/contact`, `/services`, `/capabilities`, `/<page>`,
  `/projects/<slug>`), or an
  absolute `https:`/`mailto:`/`tel:` address; checked by shape at save time (`src/fields/link.ts`)
  and again at render (`resolveLink`). Project addresses and profiles are https only
  (`httpsRule`).
- **Services** (`src/collections/Services.ts`): what the studio can be hired for. Name, one
  sentence, what is in it, an order and the projects that prove it. Each published one is a card
  on the home page (linking to its section) and a section of `/services`, lettered by its place
  among the published ones. **Capabilities** (`src/collections/Capabilities.ts`): the engineering
  under the sites, one claim each, in four areas (design, build, security, operations), each with
  where it is built in: this site (`onThisSite`), projects, or both; listed on `/capabilities`
  and named on the home page. Like the notes, nothing about either is public until one is
  published: the page answers 404 and the header, footer, home band, sitemap, share card,
  llms.txt and links in text leave it out (`PublishedIndex.services` / `.capabilities`). Proof
  shows published projects only (`proofOf` in `src/lib/payload.ts`).
- **A claim names its proof, and both are true.** A service or capability lists a project only
  where that project's code does what the sentence says; a case study says what was built, never
  that something is live (the board's status says that, checked against the address), which is
  why proof is labelled "Lines behind it" and "Built into", not "in service on". A client's case
  study, like a window, is published with the client's agreement. The seeded
  ones were checked against each project's repository on 20 November 2026; change a sentence and
  its proof together.
- **A project page is a case study** when more than one of its four chapters is written (the
  brief, what was built, under the surface, where it stands; `brief`, `story`, `engineering`,
  `outcome`): they render as stops down the line. With only `story` the page is plain text, as
  before. Its facts add who it was made for (`client`, never a private person's name), the
  studio's part (`scope`) and the services it proves.
- **Notes** (`src/collections/Notes.ts`, `src/lib/notes.ts`): title, day, summary, text and an
  optional project. A note on a project's line wears its number and colour; a note with no
  project is about the studio itself and wears the point (it is not a line, and has no chip).
  **Nothing about notes is public until three are published** (`NOTES_OPEN_AT`): `getNotes`
  returns none, so /notes and every note answer 404, and the nav, footer, home panel, project
  lists, sitemap, share cards and links in text all leave them out. A note whose project is a
  draft reads as a note about the studio. The seed writes three true notes about the studio
  (`NOTES`), enough to open them, whenever there are no notes at all, even into a database seeded
  before notes existed. Their dates are days, kept at noon UTC and shown in UTC.
- **Short links** are one word at the root (`fromnowhere.dev/giogio`), answered in
  `pick-language`; `isShortAlias` keeps the languages and the paths the site answers itself out.
  A short link and a page never share a word (both refused at save time), and pick-language
  prefers the page.
- **Live status** (Phase 2): every 5 minutes a Payload job (`src/jobs/checkStatus.ts`, queue
  `status`) knocks on every address of every published project (`src/lib/probe.ts`: GET, status
  line only, redirects followed by hand, public https names only, 10 s) and writes one row per
  address to `status-checks` (read-only in the admin; the job alone writes, and clears rows of
  addresses no published project has). Any answer below 500 counts. The site reads them through
  `getProjects`/`getProject`, which return a `LiveProject` (`service`, `unanswered`); components
  use `serviceOf(project)`, never `project.status`. A **running** line whose first address missed
  two checks in a row is **Delayed** (its trains held, its terminal and status in `--delayed`,
  "Not answering just now"); a further stop that is quiet says "No answer" beside it and on its
  exit. One miss is a blip; a check older than 30 minutes says nothing, and the editor's status
  stands. Only `running` can become delayed. The cron starts only where Payload boots with
  `cron: true` (`src/instrumentation.node.ts`, unless `STATUS_CHECKS=off`, which the end-to-end tests
  set), never in a build, a test or a script.
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
  their own that keeps `script-src 'none'`. **Every page carries a second, strict one from the
  proxy** (`src/proxy.ts`, `src/lib/csp.ts`): scripts run only with the request's nonce
  (`'strict-dynamic'`, no `'unsafe-inline'`, `'unsafe-eval'` in development only), so an injected
  script, inline handler or `javascript:` link runs nothing. Next puts the nonce on its own
  scripts; a script the site renders itself takes it from `getNonce()` (`src/lib/nonce.ts`), as
  the head script and the statistics script do. Styles stay `'unsafe-inline'` (the line colours
  are style attributes). The editor keeps only the plain policy. Every response also carries
  `nosniff`, a referrer policy, a permissions policy and `Cross-Origin-Opener-Policy`, and no
  `X-Powered-By` (Caddy sends the same set, plus HSTS).
- **The editor answers only to `ADMIN_ALLOW`** (Caddy, `caddy/Caddyfile`): /admin and the API
  it works through give 404 to every other address; uploaded files and `/api/contact/*` stay
  public. Compose refuses to start Caddy without it (no default that opens it to everyone).
- **The REST API reads nothing to a visitor** (`signedIn`, `src/access.ts`): projects, services,
  capabilities, pages, notes, short links, status checks, uploads' documents, users and the studio's settings all
  answer 403 without a session. The site reads through the Local API and never over HTTP; only
  uploaded files are public (`isReadingStaticFile`). A new collection gets `read: signedIn` too.
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
server start (`src/instrumentation.node.ts`), and exits if that fails so the container restarts.
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
4. **Done (Phase 2, 16 November 2026):** the status check (a Payload job knocking on each
   address every 5 minutes; the board, map, tally and project pages show Delayed and quiet
   stops) and share cards drawn from the route map with the project's line lit.
5. **Notes** (17 November 2026, [`docs/prototypes/notes.html`](docs/prototypes/notes.html)):
   /notes as a log on one rail, a note page with its line's route, the latest three under the
   board, a project's own notes on its page; hidden until three are published.
6. **The studio's front page** (20 November 2026): the site turned from a crossroad that read as
   a portfolio into the business's front page for clients. Studio voice with no headcount; a
   pitch and two actions in the hero; services and capabilities (two collections, two pages, two
   bands on the home page); project pages as case studies; `offer.css`. The map, the board and
   Night transit stay as they were.
7. **Phase 3, launch** ([`docs/launch.md`](docs/launch.md)): one Oracle Cloud Ampere server
   (linux/arm64, `scripts/build-image.sh`) shared with yugioh.fromnowhere.dev through
   `compose.shared.yml` (only Caddy joins the `fromnowhere-sites` network; each other site's web
   container joins it by alias, with its block in `caddy/sites/`). The About draft, Privacy and
   hello@fromnowhere.dev are in the seed (`PAGES`); the launch itself (server, DNS, mailboxes,
   first release) is the runbook's, done by hand.

## 7. Gotchas

- **Unknown addresses at any depth** reach the site's 404 through `(site)/[...rest]/page.tsx`,
  which only calls `notFound()`. A `not-found.tsx` catches `notFound()` from a route that
  matched; without the catch-all, `/hr/a/b` fell through to Next's bare white page.
- **The status check connects through `guardedLookup`** (`src/lib/probe.ts`): every address a
  name resolves to must be public, checked at connection time, so a public name pointing inside
  (127.0.0.1, the compose network) or a rebinding DNS gets nothing. Keep `fetch` out of it.
- **Never add a `loading.tsx`** (or a `<Suspense>` above a page) under
  `src/app/(frontend)/[locale]/`: streaming sends 200 before the page knows it exists, so an
  unpublished page would answer 200 instead of 404.
- **The head script is rendered only while the server's HTML hydrates** (`HeadScript`): React
  remounts the layout on the EN ↔ HR switch, and a `<script>` it inserts never runs and makes
  React warn ("Encountered a script tag"). **`src/instrumentation-client.ts`** skips, in
  development only, the one Performance measure React's dev build asks for with a negative
  time when a server component ends in `notFound()` or is cut short, which otherwise throws
  "cannot have a negative time stamp" in the browser.
- **`next dev` rewrites the block below** in this file. Leave it in place and commit it.
- **Pages render per request** (`dynamic = 'force-dynamic'`), so the image builds without a
  database and edits show at once.
- **Share cards** read `src/assets/fonts/Inter-Regular.ttf` (Satori takes TTF, not WOFF2);
  `next.config.ts` traces it into the standalone build. They draw the wide route map from
  `routeMap.ts` with the night colours as plain values (`CARD_PALETTE` in `src/lib/shareCard.ts`,
  checked against `site.css` by `tests/int/routeMap.int.spec.ts`), and use the editor's status,
  not the live one: chat apps keep a card for days. Bump `CARD_VERSION` when the card changes.
- **The status check in development** runs too (the dev server boots with `cron: true`): it
  knocks on the real addresses and the dev board shows what it hears. `STATUS_CHECKS=off` in
  `.env` stops it.
- **Dark only, and the head script**: there is no theme to set. The head script (`headScript` in
  `src/lib/motion.ts`, rendered by `[locale]/layout.tsx`) only decides, before paint, whether the
  other pages' entrances play (`fnw-calm`); the home page's opening ignores it.
- **The sky shows through `<body>`**: the page's colour is on `<html>` and `body` is transparent,
  or the body's own background would cover the `z-index: -1` sky (as it did in the prototype).
- **Seeding the second language of an array** needs the row ids of the first, or Payload replaces
  the rows (`src/seed/index.ts`).
- **A test that needs an empty install** uses its own database (`tests/helpers/freshDatabase.ts`).
- **To see the form locally** set the six `CONTACT_*` variables; without them the contact page
  shows the e-mail address instead. The relay insists on TLS with a checked certificate, so the
  local mail catcher (Mailpit in `compose.dev.yml`) speaks STARTTLS with a certificate from
  `./scripts/dev-mail.sh`, which `pnpm dev:mail` trusts through `NODE_EXTRA_CA_CERTS`. Read what
  the form sent at http://localhost:8025 (`.env.example`, the contact block).
- **What the site tells machines**: structured data on the home page (the studio and the site),
  each project (`CreativeWork`) and each note (`BlogPosting`), built in `src/lib/structuredData.ts`
  and rendered by `JsonLd` (a data block: no nonce needed, `<` escaped); an Atom feed of the notes
  per language (`/<lang>/notes/feed.xml`, named by the notes page, absent while notes are closed);
  the web manifest and app icons; `/.well-known/security.txt` from the studio's address.
- **An error while rendering** shows the site's own page ("Service interrupted", `error.tsx` in
  `(site)` with the chrome and in `[locale]` without it), with Try again; `global-error.tsx` is the
  last resort with its own document. The visitor never sees the error itself.
- **/llms.txt** (`src/app/llms.txt/route.ts`, https://llmstxt.org) describes the site in Markdown
  for language models: the studio, its published projects with their addresses, pages, open
  notes and contact. Like the sitemap it is read from the CMS per request, published only.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
