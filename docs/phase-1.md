# Phase 1 spec: the route map, windows, the page transition

This is the lead designer's spec for fromnowhere.dev, revised on 16 November 2026. It merges the "mark", "people" and "build" proposals, resolves every point the "system", "tech" and "access" sceptics raised, and closes every gap in the critic's review. I checked each gap against the code first. Every choice below is final. If a developer cannot resolve something from this spec, it goes back to the lead and is not guessed.

**Phase 1 is T1 to T4 plus T7** (section 6). T5 and T6 (section 5) are specified here but ship separately and do not hold Phase 1 up.

---

## 1. Summary

- **The route map** goes in the home hero, after the copy. It is server-rendered HTML plus `aria-hidden` SVG, with no client JavaScript and no inline `style` attributes.
  - **Wide layout.** "You are here" sits left of the point. The point is a fixed `--size-icon-xl` disc in `--logo-point`. The lines leave the point as a parallel bundle drawn on the mark's grid: one unit is 1px, lines are 3 wide and 7 apart, and the gap is 4. The outer lines peel off first at 45°, and each line runs to a plate.
  - **Plates** are real `Link`s to the project page.
  - **Lighting** is CSS only. A plate lights its own line on `:hover` (fine pointers only), on `:focus-visible` and on `:active`. A board row lights the same line through static `:nth-child` rules, but only while the map has at most six lines.
  - **Lines that are not running** are dashed `7 4`, and their plate always says why, with an icon and a word.
  - **The draw** uses transform and opacity only. The base state is the finished map, and the draw runs only under `no-preference` and `html:not(.fnw-calm)`.
  - **The rail.** Below `42rem` of container width, or with more than six lines, the same DOM becomes a vertical rail drawn in CSS. Rail plates wrap and are never truncated.
- **Windows.** The plumbing ships complete: the frame, the placement, a `windowAddress` field with its migration, a dev-only capture script, and a seed that uploads committed captures. **Phase 1 seeds zero windows by default**, because none of the destinations has a published page that may be captured honestly:
  - yugioh.fromnowhere.dev and presstart.giogio.music do not resolve;
  - gati.hr answers 503 and needs the client's consent;
  - NMT has no destination.

  Tests and screenshots use a test-only fixture image that is attached in a throwaway database. Whether a fresh release build of Press Start counts as a window is a decision for the user (see Decisions).
- **The page transition** uses React 19.3's `<ViewTransition>`, which Next 16.4 runs on every App Router navigation.
  - A client wrapper in `(site)/layout.tsx` is keyed on `usePathname()` around one real box, `.site-page`.
  - The old page fades out at `--duration-fast`/`--ease-exit` while the new one fades in at `--duration-slow`/`--ease-enter`. The two overlap, and only opacity changes.
  - The header (`fnw-nav`) is held still.
  - The root swaps instantly on soft navigations. It crossfades only on full document loads, through a typed `@view-transition` that applies only under `no-preference`.
  - After every soft navigation that changes the pathname, focus moves to `<main id="content" tabindex="-1">`.
  - Under reduced motion every change is instant.
- **Fixes bundled into Phase 1** (all in T1):
  - The broken motion plumbing: no CSS reads `.fnw-calm`, and `.is-waiting` is unstyled.
  - The theme reset on EN↔HR: the `[locale]` root layout remounts and React strips `data-theme`. The fix is a `ThemeSync` client component in `[locale]/layout.tsx`, so it covers every page, including `[locale]/not-found.tsx`.
  - A "played" key that is the same in both languages.
  - An e2e harness that runs against a throwaway Postgres and a production server on its own port.
- **Shipped separately** (T5 and T6): the four stale clinic e2e specs, the rule that short links never shadow pages, and the removal of `siteLinkRule`.

Facts this spec rests on, all verified:
- next 16.4.3 and react 19.3.1 (`node_modules/*/package.json`); `ViewTransition` is exported by `react`.
- `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`:
  - line 50: "View transitions work in the App Router with no configuration";
  - line 61: "route navigations are transitions, so `<ViewTransition>` animations activate automatically during navigation".
- fnwygo's `src/components/broadcast/PageTransition.tsx` uses the same layout-level keyed pattern, but on next 16.3.3 and react 19.2.6. It is precedent only. The e2e tests in T4 are what prove it on this site's versions.
- React runs layout effects inside `startViewTransition`'s update callback, before the new snapshot (`react-dom-client`). This means `ThemeSync`'s layout effect lands before the new snapshot is taken.
- Next's layout router does not move focus on a soft navigation. The critic observed this on the dev server: after Enter on a board link, the next Tab goes to the first exit plate; after a header link, focus stays on that link; after EN→HR, focus is on `<body>`.
- The CSP (`next.config.ts`) has no `script-src` or `style-src`. The home hero already uses inline `style={{ '--i': n }}`.
- `bundle.css:1183` hides reveals only under `.fnw-js`, which nothing sets. The reduced-motion reset at `bundle.css:1272` (`*, *::before, *::after`) does not reach `::view-transition-*`.
- Keyframes that exist in `bundle.css`:
  - `fnw-fade` (opacity);
  - `fnw-enter-sm` (opacity plus translateY `--distance-sm`);
  - `fnw-draw` (`scaleX(0)`);
  - `fnw-point-in` (opacity plus `scale(0)`).
- Tokens: `--space-section` 64px, `--size-icon-xl` 32px, `--size-icon-lg` 24px, `--border-control` #75798c in both themes (4.08:1 on the dark ground, 3.96:1 on the light ground), `--logo-point: var(--accent)`.
- The `next dev` lock:
  - `next dev` takes `.next/dev/lock` (`server/lib/router-utils/setup-dev-bundler.js:175`), so a second dev server cannot run in this directory;
  - `next build` takes `.next/lock` (`build/index.js:623`), so a build can run beside the dev server.
- The seeded Giogio addresses are `giogio.music`, `prod.giogio.music` and `presstart.giogio.music`.
- Every existing e2e spec hard-codes `http://localhost:3000`.
- `src/collections/Media.ts` honours `MEDIA_DIR`.
- The repository has one commit (`f32f29b`).

---

## 2. Route map

### 2.1 Placement and data

- `src/app/(frontend)/[locale]/(site)/page.tsx` renders `{await RouteMap({ projects, locale })}` as the last child of `<section className="fnw-hero home-hero">`, after `.fnw-hero__text`.
  - JSX `<RouteMap … />` works the same in Next. The call form matches how the int tests render it.
  - `projects` comes from the existing `getProjects(locale)`: published projects only, sorted by `line`.
- With zero projects, `RouteMap` returns `null`, and the existing `home.empty` text under the board stays.
- The map is left-aligned and capped at `max-width: 48rem`. The free space falls on the right of the hero.
- Plates link to the project's page (`projectHref(slug)` through `Link` from `src/i18n/navigation`), never to the destination. Exit plates stay the only way off the station.
- There is no "Next line" placeholder and no legend. Nothing is invented, and every plate states its own status.

### 2.2 Geometry: `src/lib/routeMap.ts` (pure, no React)

```ts
export const MAP = {
  row: 64,       // = --space-section; one row is one mark tall, so one mark unit is 1px
  stroke: 3,     // a mark bar is 3 units thick at this scale
  spacing: 7,    // stroke + the mark's 4-unit gap
  gap: 4,        // parts never touch: point↔line, line↔plate
  point: 32,     // = --size-icon-xl, the origin disc's diameter (fixed, never grows)
  lead: 32,      // straight trunk before the first bend
  runMin: 16,    // shortest straight run inside the fan after the last bend
  dash: [7, 4],  // 7 + 4 = 11, one mark plate thick
  wideMax: 6,    // more lines than this: the rail at every width, and no board→map lighting
  stopsMax: 3,   // decorative stops drawn per line
} as const
```

- Coordinates are in px, in the fan's own system.
- The **point's right edge is x = 0**. The point's centre is (−R, Cy), with R = `point/2` = 16 and Cy = 32n.

For n lines (1 ≤ n ≤ 6), line i (0-based, in line order) is built as follows:
1. **Bundle position.** `c = i − (n−1)/2`, and the bundle offset is `b = 7c`.
   - The bundle's y is `yb = oy + b`, with `oy = 32n + (n odd ? 0.5 : 0)`, so horizontal strokes cover whole pixels.
2. **Travel.** The row centre is `yr = 64i + 32.5`, and the vertical travel is `d = yr − yb`.
3. **Start on the gap circle** around the point: `xs = −R + sqrt((R + gap)² − (yb − Cy)²)`.
   - For n ≤ 6, every |yb − Cy| ≤ 18, which is less than R + gap = 20, so every line starts on the arc.
   - Starts left of x = 0 paint into the origin column through `overflow: visible`.
4. **Rank from the outside on its side:** `k = round((n−1)/2 − |c|)`.
5. **Bend start:** `Bx = (gap + lead) + k · 7 · (√2 − 1)`. This keeps parallel 45° diagonals exactly 7 apart.
   - The diagonal ends at `Ex = Bx + |d|`.
6. **Path:** `M xs yb H Bx L Ex yr H W`. When d = 0 (the middle line when n is odd), the path is `M xs yb H W`.
7. **Fan width:** `W = ceil(max(Ex)) + runMin`, shared by all lines. Expected values: n=1 → 52, n=4 → 138, n=6 → 195.
8. **Dash phase:** `fanLength` is the sum of the horizontals plus √2·|d|.
   - `runDashOffset = ((fanLength − 1) mod 11 + 11) mod 11`, so the dash pattern carries across the join into the run, which starts at x = −1.
9. Every number is rounded to 0.01.

Exports:
- `wideMap(n): { width: number; height: number; lines: { d: string; viewBox: string; runDashOffset: number }[] } | null`
  - It returns null when n < 1 or n > `MAP.wideMax`.
  - Each line's `viewBox` is `0 ${64*i} ${W} 64`.
- `stopsFor(addressCount): number[]` gives stop positions as percentages, `k/(m+1)·100` for k = 1..m, where m = min(addressCount − 1, stopsMax).
- A doc comment states the six-line limit: beyond six lines the map is the rail, and board rows do not light it.

### 2.3 Component split and files

- `src/lib/routeMap.ts`: the geometry above.
- `src/components/site/RouteMap.tsx`: one async Server Component.
  - It calls `getTranslations` once per namespace at the top: `home`, `map`, `project`, `status`, `board`.
  - It renders **no nested async components**. `renderToStaticMarkup` cannot render them, so it uses only synchronous children.
  - No `'use client'` and no `style` attributes.
- `src/components/site/Signs.tsx` (T2 owns it in Phase 1): extract the status icon SVG from `StatusTag` into a synchronous `export function StatusIcon({ running }: { running: boolean })`. `StatusTag` and `RouteMap` both use it, and the markup does not change.
- `src/app/(frontend)/[locale]/routemap.css`: all map CSS, including the board→map rules. `[locale]/layout.tsx` imports it after `site.css` (the import is added in T1).

### 2.4 Markup

```tsx
<nav className={`map${rail ? ' map--rail' : ''}`} aria-label={tHome('mapLabel')}>
  <div className="map__body">
    <div className="map__origin" aria-hidden="true">
      <span className="map__here">{tHome('origin')}</span>
      <span className="map__point" />
    </div>
    <ol className="map__lines" role="list">
      {projects.map((p, i) => {
        const addresses = p.addresses ?? []
        return (
          <li key={p.id} className={`map-line${isRunning(p) ? '' : ' map-line--dashed'}`} data-line={p.slug}>
            {geo && (
              <svg className="map-line__fan" width={geo.width} height={64} viewBox={geo.lines[i].viewBox}
                   aria-hidden="true" focusable="false">
                <path d={geo.lines[i].d} />
              </svg>
            )}
            {geo && (
              <svg className="map-line__run" height={64} aria-hidden="true" focusable="false">
                <line x1={-1} y1={32.5} x2="100%" y2={32.5} strokeDashoffset={geo.lines[i].runDashOffset} />
                {stopsFor(addresses.length).map((x) => <circle key={x} cx={`${x}%`} cy={32.5} r={4} />)}
              </svg>
            )}
            <Link className="map-plate" href={projectHref(p.slug)}>
              <span className="map-plate__num" aria-hidden="true">{lineNumber(p.line)}</span>
              <span className="fnw-sr">{tProject('line', { number: lineNumber(p.line) })}{tMap('pause')}</span>
              <span className="map-plate__name">{p.name}</span>
              <span className="fnw-sr">{tMap('pause')}</span>
              <span className="map-plate__where">{/* see below */}</span>
            </Link>
          </li>
        )
      })}
    </ol>
  </div>
</nav>
```

- `<nav class="map">` is the **query container**. `.map__body` is its child and carries the wide two-column grid, because a container query can style only descendants of its container.
- `rail = n > MAP.wideMax`, and `geo = rail ? null : wideMap(n)`. With `map--rail` the server renders no SVGs at all.
- The run `<svg>` has no `width` attribute; CSS sizes it (2.5).
- `.map-plate__where`, by case:
  - **Running with an address:** `<span className="map-plate__addr">{displayAddress(first)}</span>`. When there are more addresses, add `<span className="map-plate__more"><span aria-hidden="true"> · </span><span className="fnw-sr">{tMap('pause')}</span>{tMap('more', { count: addresses.length − 1 })}</span>`.
  - **Status not `running`:** `<StatusIcon running={false} />` followed by `tStatus(status)`.
  - **Running with no address** (dashed, because `isRunning` is false): `tBoard('here')`.
- Accessible names contain the visible text (WCAG 2.5.3), for example:
  - "Line 02, Giogio, giogio.music, 2 more addresses";
  - "Line 03, Nowhere's Medical Toolbox, Building".

  There is no `aria-label` on links. The visible "02" becomes "Line 02" in the name, which contains it.
- Use `.fnw-sr` from bundle.css (`bundle.css:88`). Do not add a new visually-hidden class.
- `<li>` stays a real box. **Never use `display: contents`**; use subgrid (2.5).

### 2.5 CSS (`routemap.css`; tokens only)

Custom properties:

```css
.map {
  container: map / inline-size;
  max-width: 48rem;
  --map-unit: calc(var(--space-section) / 64);   /* 1px */
  --map-stroke: calc(3 * var(--map-unit));
  --map-gap: calc(4 * var(--map-unit));
  --route: var(--border-control);                 /* ≥3:1 on ground and surface, both themes */
  --route-dim: color-mix(in srgb, var(--route) 40%, var(--ground));  /* opaque, never opacity */
  --rail-pad: calc(var(--size-icon-xl) + var(--space-6));
  --map-t0: calc(4 * var(--duration-stagger));   /* after the hero copy (--i 0..3) */
}
.map-line {
  --line-ink: var(--route);        /* the line itself: fan, run, spur */
  --trunk-ink: var(--route);       /* rail trunk from the top of this segment down to this spur */
  --trunk-after: var(--route);     /* rail trunk below this spur, on to the next line */
  --plate-edge: var(--shadow-sm);
  --plate-border: transparent;
  --num-ring: none;
  --plate-edge-lit: 0 0 0 1px var(--accent);
  --plate-border-lit: transparent;
}
.map-line--dashed {                 /* after .map-line: same specificity, later wins */
  --plate-edge: none;
  --plate-border: var(--border-control);
  --plate-edge-lit: none;
  --plate-border-lit: var(--accent);
}
```

Every lit rule, whether from the plate or the board, sets the same **lit bundle**:

```
--line-ink: var(--accent); --trunk-ink: var(--accent);
--plate-edge: var(--plate-edge-lit); --plate-border: var(--plate-border-lit);
--num-ring: inset 0 0 0 1px var(--accent);
```

The same declarations then light a solid plate (a 1px accent edge in place of the shadow) and a dashed plate (an accent dashed border and no shadow). The number badge gets its ring either way.

**The base layout is the rail** (mobile first). Where container queries are unsupported, the rail shows, which is safe.
- `.map__body`: `display: block`.
- `.map__origin`: `display: flex; flex-direction: row-reverse; justify-content: flex-end; align-items: center; gap: var(--space-4); margin-block-end: var(--map-gap)`. The point comes first on the left and the label to its right.
- `.map__point`: `width/height: var(--size-icon-xl); border-radius: var(--radius-round); background: var(--logo-point)`.
- `.map__here`: 11px, weight 500, `letter-spacing: 0.1em`, uppercase, `--text-muted`, `white-space: nowrap`.
- `.map__lines`: `display: grid; gap: var(--space-4); margin: 0; padding: 0 0 0 var(--rail-pad); list-style: none`.
- `.map-line`: `position: relative`, and `--spur-at: calc(50% + var(--space-4) / 2 + var(--map-stroke) / 2)`.
- `.map-line:first-child`: `--spur-at: calc(50% + var(--map-stroke) / 2)`.
- `.map-line__fan` and `.map-line__run`: `display: none`.
- `.map-line::before` is the trunk segment, split at its spur:
  - `content: ''; position: absolute; inset-block: calc(-1 * var(--space-4)) 0; inset-inline-start: calc(var(--size-icon-xl) / 2 - var(--map-stroke) / 2 - var(--rail-pad)); width: var(--map-stroke)`.
  - `background: linear-gradient(to bottom, var(--trunk-ink) 0 var(--spur-at), var(--trunk-after) 0)`.
  - Why `--spur-at`: the segment is the li's height H plus `--space-4` tall and starts `--space-4` above the li, so the spur's lower edge is at 50% + `--space-4`/2 + stroke/2 of the segment.
  - `:first-child` uses `inset-block-start: 0`, which leaves the gap below the point.
  - `:last-child` uses `inset-block-end: calc(50% - var(--map-stroke) / 2)` and ends at its spur, so it never has a below-spur part.
- `.map-line::after` is the spur:
  - `content: ''; position: absolute; top: calc(50% - var(--map-stroke) / 2); height: var(--map-stroke); inset-inline-start: calc(var(--size-icon-xl) / 2 + var(--map-stroke) / 2 - var(--rail-pad)); width: calc(var(--rail-pad) - var(--size-icon-xl) / 2 - var(--map-stroke) / 2 - var(--map-gap)); background: var(--line-ink)`.
  - Dashed spur: `background: repeating-linear-gradient(90deg, var(--line-ink) 0 calc(7 * var(--map-unit)), transparent 0 calc(11 * var(--map-unit)))`.
- Rail plates wrap: `.map-plate__name, .map-plate__where { overflow-wrap: anywhere }`, with no `nowrap` and no ellipsis. Plates use `min-height` and grow with their text.
- `@media (max-width: 520px) { .home-hero { padding-inline: var(--space-6) } }`, so rail plates have room at 320px.

**Wide layout:** `@container map (width >= 42rem)`. Every selector inside is scoped as `.map:not(.map--rail) <descendant>`, so the container (`.map`) is never its own subject.
- 42rem fits the origin (about 145px), the n=6 fan (195), a run (64), the gap and the smallest plate (15rem).
- The breakpoint is in rem, so text-only zoom flips to the rail.

```css
@container map (width >= 42rem) {
  .map:not(.map--rail) .map__body { display: grid; grid-template-columns: auto minmax(0, 1fr); }
  .map:not(.map--rail) .map__origin { flex-direction: row; align-self: center; margin: 0; gap: var(--space-4); }
  .map:not(.map--rail) .map__lines {
    padding: 0; gap: 0;
    grid-template-columns: auto minmax(var(--space-section), 1fr) minmax(15rem, 20rem);
    grid-auto-rows: var(--space-section);
  }
  .map:not(.map--rail) .map-line {
    display: grid; grid-column: 1 / -1; grid-template-columns: subgrid;
    grid-template-rows: var(--space-section); align-items: center;
  }
  .map:not(.map--rail) .map-line::before,
  .map:not(.map--rail) .map-line::after { display: none; }
  .map:not(.map--rail) .map-line__fan { display: block; grid-column: 1; overflow: visible; pointer-events: none; }
  .map:not(.map--rail) .map-line__run {
    display: block; grid-column: 2; justify-self: stretch; width: auto; min-width: 0;
    margin-inline-end: var(--map-gap); overflow: visible; pointer-events: none;
  }
  .map:not(.map--rail) .map-plate {
    grid-column: 3; align-self: center;
    block-size: calc(var(--space-section) - 2 * var(--space-1)); min-height: 0; overflow: clip;
  }
  .map:not(.map--rail) :is(.map-plate__name, .map-plate__where) {
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
}
```

- "You are here" sits left of the point, on the point's centre line, so it can never collide with a line. The origin column's right edge is the point's right edge, which is fan x = 0.
- `.map__lines` is exactly 64n tall, so the centred origin sits at y = 32n.
- The fan's `width` attribute sizes column 1. Its `viewBox` shows its own row, while the path, drawn in fan coordinates, paints across all rows.
- `justify-self: stretch` matters. Without it, an `<svg>` with no definite width falls back to 300px and runs under the plate. With it, the run fills the track minus the gap. The `x1 = −1` overlap and the opaque colours hide the join.
- **The text-growth policy (wide only):**
  - A wide plate is exactly one row tall, and its name and where line each clamp to one line with an ellipsis.
  - Under a large browser minimum font size, which rem queries do not see, the where line may be clipped at the plate's lower edge. It never overlaps the next row.
  - The full text stays in the accessible name and on the board.
  - `overflow: clip` never clips the plate's own focus outline or box-shadow.
- Strokes:
  - `.map-line__fan path, .map-line__run line { fill: none; stroke: var(--line-ink); stroke-width: 3; stroke-linecap: butt; stroke-linejoin: round; transition: stroke var(--duration-fast) var(--ease-standard) }`
  - `.map-line--dashed :is(.map-line__fan path, .map-line__run line) { stroke-dasharray: 7 4 }`
  - `.map-line__run circle { fill: var(--ground); stroke: var(--line-ink); stroke-width: 3 }`

**The plate**, in both layouts:
- `.map-plate`:
  - `display: grid; grid-template-columns: var(--size-icon-lg) minmax(0, 1fr); column-gap: var(--space-4); align-items: center; min-height: calc(var(--space-section) - 2 * var(--space-1))`. That is 58.4px, which is at least 44.
  - `padding: var(--space-2) var(--space-6) var(--space-2) var(--space-4); border: 1px solid var(--plate-border); border-radius: var(--radius-md); background: var(--surface); box-shadow: var(--plate-edge); color: var(--text); text-decoration: none; transition: box-shadow var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)`.
  - The lit edge replaces `--shadow-sm`. Shadows never stack.
- `.map-line--dashed .map-plate { background: transparent; border-style: dashed }`. It reads as a sign not yet mounted. The colours come from the variables.
- `.map-plate__num`: `grid-row: span 2; display: grid; place-items: center; width/height: var(--size-icon-lg); border-radius: var(--radius-sm); background: var(--tag-neutral); color: var(--tag-neutral-ink); box-shadow: var(--num-ring); font: 500 11px var(--font-mono); font-variant-numeric: tabular-nums`.
- `.map-plate__name`: 15px, weight 500.
- `.map-plate__where`: 13px, `--text-muted`.
  - `.map-plate__addr` and `.map-plate__more` use `--font-mono`.
  - The status word uses Inter, with the ring at 12px, `display: inline-flex; gap: var(--space-2)`.
  - Status stays muted, never `--warning`. The station is quiet.
- `.map-plate:active`: `background: color-mix(in srgb, var(--surface), var(--text) 14%)`, applied instantly.
- Focus uses the global `:focus-visible` ring and is never animated.

### 2.6 States (CSS order matters; keep this order)

1. **Rest.** The variables are as set on `.map-line` and `.map-line--dashed`.
2. **The others step back** while any plate is lit:
   - `.map:has(.map-plate:is(:focus-visible, :active)) .map-line { --line-ink: var(--route-dim); --trunk-ink: var(--route-dim); --trunk-after: var(--route-dim) }`
   - The same rule with `:hover` goes inside `@media (hover: hover) and (pointer: fine)`.
   - Dimmed lines are about 1.6:1 against the ground. That is acceptable only because every plate carries its status as an icon plus a word, which stays mandatory.
3. **Lit.** `.map .map-line:has(.map-plate:is(:focus-visible, :active)) { <lit bundle> }`, plus the `:hover` variant in the same media query.
   - The `.map` prefix gives this rule the same specificity as step 2, and it wins because it comes later.
   - `--trunk-after` stays dimmed, so the trunk lights down to this line's spur and no further.
   - Accent appears only as a line, a 1px edge, a ring and the point. It is never a fill.
4. **Trunk to a lit line (rail).** `.map .map-line:has(~ .map-line .map-plate:is(:focus-visible, :active)) { --trunk-ink: var(--accent); --trunk-after: var(--accent) }`, plus the `:hover` variant.
   - Lines above the lit line light their whole trunk segment.
   - No selector nests `:has()` inside `:has()`.
5. **Only the plate lights its line.** Hovering the run does nothing; it is not clickable.
6. **Board → map.** Board rows and map lines render the same `getProjects` array in the same order.
   - Rules are keyed on `.site-main`, which `(site)/layout.tsx` already renders, so T2 does not depend on T4.
   - Rules are scoped to `.map:not(.map--rail)`, so with more than six lines no board row lights or dims anything.
   - k runs from 1 to 6 (`MAP.wideMax`). Write the rules out statically:

   ```css
   @media (hover: hover) and (pointer: fine) {
     .site-main:has(.board tbody tr:hover) .map:not(.map--rail) .map-line {
       --line-ink: var(--route-dim); --trunk-ink: var(--route-dim); --trunk-after: var(--route-dim);
     }
     .site-main:has(.board tbody tr:nth-child(K):hover) .map:not(.map--rail) .map-line:nth-child(K) { <lit bundle> }
     /* K ≥ 2 only */
     .site-main:has(.board tbody tr:nth-child(K):hover) .map:not(.map--rail) .map-line:nth-child(-n + K−1) {
       --trunk-ink: var(--accent); --trunk-after: var(--accent);
     }
   }
   /* Keyboard, outside the media query: the same three shapes with
      `tr a:focus-visible` (dim) and `tr:nth-child(K) a:focus-visible` (lit, trunk). */
   ```

   - Never use `:focus-within`, which would stick after a mouse click and Back.
   - Never nest `:has()`; Chromium drops the whole rule. The shape `.site-main:has(.board tbody tr:nth-child(K) a:focus-visible) …` is supported.
   - Specificity: the board rules (0,6,2) beat the plate rules (0,4,0). If a plate is focused while a board row is hovered, the board wins. That case is accepted.
   - The board does light the rail when there are at most six lines and the container is narrow. That is consistent: whenever the map has six lines or fewer, the board lights it in either layout.
7. **Forced colours:**

   ```css
   @media (forced-colors: active) {
     .map { --route: CanvasText; --route-dim: GrayText; }
     .map .map-line:has(.map-plate:is(:focus-visible, :active)) { --line-ink: Highlight; --trunk-ink: Highlight; }
     .map__point, .map-line::before, .map-line::after,
     .map-line__fan, .map-line__run { forced-color-adjust: none; }
     .map__point { background: CanvasText; }
     .map-line__run circle { fill: Canvas; }
   }
   ```

   The plate keeps `forced-color-adjust: auto`, so its border shows as a system colour.

### 2.7 Drawn once per visit (transform and opacity only)

- **Stagger:** static rules `.map-line:nth-child(2) { --i: 1 }` through `:nth-child(6) { --i: 5 }`, and `:nth-child(n+7) { --i: 6 }`. motion.md caps the stagger at 6.
- **Every map animation** sits inside `@media (prefers-reduced-motion: no-preference) { html:not(.fnw-calm) … }`.
  - Keyframes are `from`-only with fill `both`, so a skipped or failed animation shows the finished map.
  - No `stroke-dashoffset` is animated. The run's static `stroke-dashoffset` attribute only aligns the dashes.
- Every entrance uses `--duration-slow` or slower, with `--ease-enter` or `--ease-settle`. Nothing in the draw uses `--duration-fast`.
- **Schedule.** T0 = `--map-t0` (240ms), I = `var(--i, 0) * var(--duration-stagger)`, and S = `--duration-slow`.

| Part | Keyframe | Duration / ease | Delay |
|---|---|---|---|
| `.map-plate` | `fnw-enter-sm` | slow / enter | T0 + I (links never wait for lines) |
| `.map__point` | `fnw-point-in` | slower / settle | T0 |
| `.map-line__fan` | `fnw-fade` | slow / enter | T0 + S + I |
| `.map-line__run` (solid) | `fnw-draw`, `transform-origin: left center` | slower / settle | T0 + 2S + I |
| `.map-line__run` (dashed) | `fnw-fade` | slow / enter | T0 + 2S + I |
| `.map-line__run circle` | `fnw-fade` | slow / enter | T0 + 2S + slower + I |
| rail `::before` (trunk) | new `map-rail { from { transform: scaleY(0) } }`, `transform-origin: top` | slow / settle | T0 + S + I |
| rail `::after` (solid spur) | `fnw-draw`, `transform-origin: left` | slower / settle | T0 + 2S + I |
| rail `::after` (dashed spur) | `fnw-fade` | slow / enter | T0 + 2S + I |

- Dashed lines fade in rather than draw, because they are not finished. This applies in both layouts.
- **Once per visit.** The head script and `<Motion>` add `fnw-calm` for a page already played this session, or under reduced motion.
  - The played key does not include the language (5.0), so switching EN↔HR does not redraw.
  - Without JS there is no session memory, so the CSS-only draw plays on every load. That is harmless, and it still stops under reduced motion.

### 2.8 No JS, keyboard, screen reader

- **No JS:** everything works. Plates are real `<a>` links, lighting is CSS `:has()`, and the draw is CSS.
- **Keyboard:** Tab goes header → map plates in line order → board links → contact band. Focusing a plate lights its line and shows the 2px ring. Focusing any link in board row k lights line k (n ≤ 6).
- **Screen reader:**
  - There is one `<nav>` landmark, "Route map" / "Karta linija", holding an `<ol role="list">`. The role is there because VoiceOver drops list semantics under `list-style: none`.
  - The point, the label, the SVGs, the stops and the middle dot are `aria-hidden`.
  - The map and the board both list the projects on purpose: the map is navigation and the board is the table. The landmark lets a reader skip the map in one keystroke.

### 2.9 Message keys

Owned by T1, with identical trees in both files. The placeholder regex in `tests/int/messages.int.spec.ts` gives `['count']` for both values below.

| Key | en | hr |
|---|---|---|
| `home.mapLabel` (value changed) | `Route map` | `Karta linija` |
| `map.pause` (new) | `, ` | `, ` |
| `map.more` (new) | `{count, plural, one {# more address} other {# more addresses}}` | `još {count, plural, one {# adresa} few {# adrese} other {# adresa}}` |

- Reused keys: `home.origin`, `project.line`, `status.*`, `board.here`.
- New keys for the window (3.2):

| Key | en | hr |
|---|---|---|
| `project.window` (new) | `A glimpse of the destination` | `Pogled na odredište` |

---

## 3. Windows

### 3.1 What a window is

A window is one real, still picture of a destination's first screen on a phone, in its own colours and type, framed by the station. It is the only place another brand appears. It is **not** any of these:
- a link (the exit plates below it are the doors);
- an iframe (third-party code, frame-ancestors, weight);
- a hand-coded postcard (invented content and foreign fonts);
- a capture of demo or seed data;
- a capture of a page that is not published.

When no honest capture exists, the page shows no window. **In Phase 1 that is every project** (see Decisions).

### 3.2 Anatomy: `src/components/site/Window.tsx` (Server Component)

```tsx
<figure className="window" aria-label={caption ? undefined : t('window')}>
  <div className="window__frame">
    <div className="window__bar" aria-hidden="true">
      <span className="window__addr">{displayAddress(project.windowAddress || addresses[0]?.url) || project.name}</span>
      <span className="window__num">{lineNumber(project.line)}</span>
    </div>
    <div className="window__view"><MediaImage media={window} sizes="20rem" /></div>
  </div>
  {caption && <figcaption className="window__caption">{caption}</figcaption>}
</figure>
```

- It renders only when `project.window` is a populated media document. Otherwise it renders nothing.
- The bar is `aria-hidden`. The kicker already says the line, the exit plates give the addresses, and the alt text describes the picture.
- The image stays lazy (Next's default), so it never holds a soft navigation's snapshot up behind React's 500ms image wait.
- `window.css`:

```css
.window { margin: 0; display: grid; gap: var(--space-3); max-width: 20rem; }
.window__frame { display: grid; gap: var(--space-2); padding: var(--space-2);
  border: 1px solid transparent; border-radius: var(--radius-md);
  background: var(--surface); box-shadow: var(--shadow-sm); }
.window__bar { display: flex; justify-content: space-between; gap: var(--space-4);
  padding: var(--space-1) var(--space-2) 0; font: 400 11px var(--font-mono); color: var(--text-muted); }
.window__addr { min-width: 0; overflow-wrap: anywhere; }
.window__view { aspect-ratio: 4 / 5; border-radius: var(--radius-sm); overflow: hidden; background: var(--ground); }
.window__view img { display: block; width: 100%; height: 100%; object-fit: cover; }
.window__caption { margin: 0; font-size: 13px; color: var(--text-muted); }
```

- Nothing touches the picture: no tint, filter, overlay or blend, and no motion (no reveal, no hover lift). It looks the same in both themes, so a dark destination in a light frame is intended.
- **Placement:** the first child of `<aside className="project__facts">`, before `.project__exits` (look through the window, then go out the door). Below 860px the order is story → window → exit plates → facts.
- The old full-width `<figure className="window">` block after `.project__body` is deleted (T3). The old `.window*` rules in `site.css` are deleted (T1).

### 3.3 Schema change: `windowAddress`

- Add to `src/collections/Projects.ts`, after `window`: `{ name: 'windowAddress', type: 'text', maxLength: MAX_LINK_LENGTH, label: l('The window shows', 'Prozor prikazuje') }`. It is not localised.
- Admin description: "Which of the addresses above the picture is of. Empty: the first one." / "Koju od gornjih adresa slika prikazuje. Prazno: prvu."
- `beforeValidate` trims the value.
- `validate` accepts an empty value, or one equal to one of the trimmed `data.addresses[].url`. Otherwise it returns "Use one of this project's addresses, or leave it empty." / "Upišite jednu od adresa ovog projekta ili ostavite prazno."
- New `window` description:
  - en: "A phone-width picture (4:5) of one of its published addresses in its own look, taken with pnpm capture:windows. Check that it shows no one's personal details. The only place another brand's colours appear on this site."
  - hr: "Slika jedne od njegovih objavljenih adresa na mobitelu (4:5), u vlastitom izgledu, snimljena naredbom pnpm capture:windows. Provjerite da ne prikazuje ničije osobne podatke. Jedino mjesto gdje se boje drugog branda pojavljuju na ovom webu."
- `windowCaption` is unchanged. The editor writes the capture month into it.
- **Migration:** `pnpm generate:types` → `pnpm payload migrate:create window_address`. Commit the `.ts`, its `.json` snapshot and `src/migrations/index.ts`.
  - Expected SQL: `ALTER TABLE "projects" ADD COLUMN "window_address" varchar;` and `ALTER TABLE "_projects_v" ADD COLUMN "version_window_address" varchar;`.
  - `down()` drops both columns. The change is additive, and nothing has run in production.
  - Descriptions are emitted as JSDoc in `payload-types.ts`, so `pnpm generate:types` must run after them too.

### 3.4 Capture: `scripts/capture-windows.ts` (dev only, never in CI, never in the image)

- `package.json`: `"capture:windows": "tsx scripts/capture-windows.ts"`.
- Usage: `pnpm capture:windows [--only=<slug>] [--source=<slug>=<url>] [--out=<dir>]`. `--out` defaults to `src/seed/windows`.
- It reads the manifest **`src/seed/windowSeeds.ts`**. The name differs from the `src/seed/windows/` directory, so imports never depend on whether a file or a directory resolves first.

```ts
export type WindowSeed = {
  slug: string; file: string;                 // <windowsDir>/<file>
  address: string;                            // one of the project's addresses: what the picture is OF
  source?: string;                            // where to capture from when that differs from address
  colorScheme: 'dark' | 'light';              // the destination's primary look
  waitFor?: string;                           // optional selector
  alt: { en: string; hr: string };
  caption: { en: string; hr: string };        // says what and when
}
/** Committed captures of published destinations. Empty until one is live (AGENTS.md, "Nothing is invented"). */
export const WINDOWS: WindowSeed[] = []
```

- With an empty manifest, the script prints "Nothing to capture: src/seed/windowSeeds.ts lists no windows." and exits 0.
- **Procedure:**
  1. Open Playwright `chromium` (from `@playwright/test`) with the context `{ viewport: { width: 390, height: 488 }, deviceScaleFactor: 2, reducedMotion: 'reduce', colorScheme, locale: 'en-GB' }`.
  2. `goto(source ?? address, { waitUntil: 'networkidle' })`, then wait for `document.fonts.ready`, then for `waitFor` if set, then 500ms.
  3. Take a viewport screenshot and convert it with sharp: resize to exactly 780×976, WebP quality 80, written to `<out>/<file>`.
  4. Fail if the file is over 150 KB.
- After writing, it prints a checklist:
  - the page is a real published page, not a preview, demo or seed data;
  - it shows no one's personal details;
  - the client agreed, for client sites;
  - the alt and caption have been rewritten against the actual picture.
- **T3 proves the script once by hand** and commits nothing from the run.
  - Use a temporary manifest entry for `locals` with `source=http://localhost:3000/en` (this site) and `--out=<scratch dir>`.
  - Check that the output is 780×976 and at most 150 KB, then discard it and the entry.
- **Phase 1 captures: none.**
  - **Locals** waits until yugioh.fromnowhere.dev is live with real content. fnwygo's dev server shows demo events (`../fnwygo/scripts/seed-demo.ts`).
  - **Giogio** waits until presstart.giogio.music or giogio.music is live (see Decisions for the release-build alternative).
  - **Gati** waits for the client's agreement and a live www.gati.hr.
  - **NMT** has no destination.

### 3.5 Seed changes: `src/seed/index.ts`

- New signature: `seed(payload, { windowsDir = path.resolve(process.cwd(), 'src/seed/windows'), windows = WINDOWS } = {})`.
  - Never resolve from `import.meta.url`. The seed is bundled into `.next/server/chunks`, and the standalone server's cwd is `/app`.
  - The `windows` parameter exists so tests can pass a fixture manifest.
- After each project's create and its `hr` update, if `windows` has an entry for the slug and `fs.existsSync(path.join(windowsDir, file))`:
  1. `payload.create({ collection: 'media', locale: 'en', data: { alt: alt.en, focalX: 50, focalY: 0 }, filePath })`
  2. `payload.update({ collection: 'media', id, locale: 'hr', data: { alt: alt.hr } })`
  3. `payload.update({ collection: 'projects', id, locale: 'en', data: { window: id, windowAddress: address, windowCaption: caption.en } })`
  4. `payload.update({ collection: 'projects', id, locale: 'hr', data: { windowCaption: caption.hr } })`
- When an entry's file is missing, log `payload.logger.info('Seed: no window for <slug> (<file> not found).')`. Nothing is invented, and the seed completes.
- Dockerfile runner stage: `COPY --from=builder --chown=nextjs:nodejs /app/src/seed/windows ./src/seed/windows`. Commit `src/seed/windows/.gitkeep` so the directory always exists.
- README seed paragraph: mention `src/seed/windowSeeds.ts`, `src/seed/windows/*.webp` and `pnpm capture:windows`, and say that a window is added only for a published destination.

### 3.6 Test fixture (tests only)

`tests/helpers/fixtureWindow.ts` (T3):
- `makeFixtureWebp(dir)` writes a 780×976 WebP with sharp: two flat bands, `#101830` over `#3a6df0`. It is a test picture, never committed under `src/`.
- `attachFixtureWindow(payload, slug = 'giogio')` creates a media document and sets the window fields. Its alt is en "Test picture: two blue bands." / hr "Testna slika: dvije plave trake.". It sets `windowAddress: 'https://presstart.giogio.music'` and caption en "Test window." / hr "Testni prozor.".
  - It returns `detach()`, which clears the three fields and deletes the media document.
- The int tests, `windows.e2e.spec.ts` and T7's visual spec use it. It runs only against the throwaway databases of section 7.

---

## 4. Page transition

### 4.1 Mechanism

The mechanism is React `<ViewTransition>`, documented in `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`:
- line 50: no configuration;
- line 61: route navigations are transitions that activate `<ViewTransition>`;
- Step 4 of the guide: a `key` change gives an exit and enter pair.

The guide puts the wrapper in each `page.tsx` because "layouts persist". Here a **pathname key** makes one layout-level boundary exit and enter on every navigation. CSS cross-document `@view-transition` does nothing for App Router soft navigations, so it is used only for full document loads. There is no `next.config.ts` change, no `loading.tsx` and no `<Suspense>`.

New file `src/components/site/PageTransition.tsx`:

```tsx
'use client'
import { usePathname } from 'next/navigation'
import { useEffect, ViewTransition } from 'react'

// The last pathname this tab rendered. Module scope survives the (site) layout remounting on
// EN↔HR, and React's development double effects see the same path twice and do nothing.
let lastPath: string | undefined

// Every navigation is an exit and an enter of the page box; the header (fnw-nav) is held still.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  useEffect(() => {
    // A soft navigation to a new page: put focus at the start of the new content, as the skip
    // link would. Not on a full load (lastPath undefined) and not on hash-only changes.
    if (lastPath !== undefined && lastPath !== pathname) {
      document.getElementById('content')?.focus({ preventScroll: true })
    }
    lastPath = pathname
  }, [pathname])
  return (
    <ViewTransition key={pathname} enter="fnw-page-in" exit="fnw-page-out" default="none">
      <div className="site-page">{children}</div>
    </ViewTransition>
  )
}
```

- `(site)/layout.tsx`: `<main id="content" className="site-main wrap" tabIndex={-1}><PageTransition>{children}</PageTransition></main>`. `<Motion />` stays outside.
- With `tabIndex={-1}`, the skip link now focuses `<main>` as well.
- The key from `next/navigation` includes the language, so these all animate: `/projects/a → /projects/b`, EN↔HR, and not-found.
  - Hash-only changes keep the key and do not animate.
  - `default="none"` keeps Server Action re-renders and `router.refresh()` from animating.
- **Never give the boundary a `name`.** Distinct old and new boundaries keep their groups apart, so nothing morphs in size or position.
- `.site-page` is a real box: `display: grid; gap: var(--space-section)` plus `> * { min-width: 0 }`. T1 defines it in `site.css`.
- **Focus decision.** After every soft navigation that changes the pathname, focus is on `#content`, and the next Tab reaches the first focusable element inside it. After a full load, focus starts at the document, so Tab reaches the skip link. Next's route announcer still reads the new title.

### 4.2 CSS (`src/app/(frontend)/[locale]/transition.css`)

```css
::view-transition { pointer-events: none; }

/* <main> takes focus after a soft navigation and from the skip link; it is a target, not a control. */
#content:focus { outline: none; }

/* Soft navigations: LanguageSwitch's href changes in the header on every navigation, so React
   always snapshots the root. The root (footer, background) swaps at once; only the page box fades. */
::view-transition-old(root), ::view-transition-new(root) { animation: none; }

/* The header stays put (.site-nav has view-transition-name: fnw-nav). */
::view-transition-group(fnw-nav) { animation: none; z-index: 1; }
::view-transition-old(fnw-nav) { display: none; }
::view-transition-new(fnw-nav) { animation: none; }

/* A quiet, overlapping crossfade: the exit is faster than the entrance, opacity only, no delay. */
::view-transition-old(.fnw-page-out) { animation: fnw-page-out var(--duration-fast) var(--ease-exit) both; }
::view-transition-new(.fnw-page-in) { animation: fnw-fade var(--duration-slow) var(--ease-enter) both; }
@keyframes fnw-page-out { to { opacity: 0; } }

/* Full document loads (no JS, plain <a>, entering from /pick-language): the root crossfades. */
@media (prefers-reduced-motion: no-preference) {
  @view-transition { navigation: auto; types: fnw-doc; }
}
:root:active-view-transition-type(fnw-doc)::view-transition-old(root) {
  animation: fnw-page-out var(--duration-fast) var(--ease-exit) both;
}
:root:active-view-transition-type(fnw-doc)::view-transition-new(root) {
  animation: fnw-fade var(--duration-slow) var(--ease-enter) both;
}

/* bundle.css's reduced-motion reset cannot reach these pseudo-elements. */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
}
```

- The whole change takes 280ms. Named participants (the header and the page box) skip hit-testing only for that long.
- On a first visit, the new page's own `.fnw-enter` and the map draw play inside the new snapshot. On a calm revisit the page just crossfades. Nothing travels twice.

### 4.3 The language switch (bundled fix, T1)

EN↔HR is a soft navigation, but the `[locale]` root layout remounts. The header and `<main>` become new nodes, and React resets `<html>`'s attributes, so `data-theme` reverts to `dark` for a light-mode visitor.

The fix:
- New file `src/components/ThemeSync.tsx` (`'use client'`). Its `useLayoutEffect` on `usePathname()` sets `document.documentElement.dataset.theme` with `themeFor(matchMedia)`, the same helper the head script uses (`src/lib/motion.ts`).
- `[locale]/layout.tsx` mounts it inside `<body>`, so it covers every page under the root layout, including `[locale]/not-found.tsx`.
- React runs layout effects inside `startViewTransition`'s update, before the new snapshot, so the crossfade never flashes dark into light.
- The header is held still by its CSS name even when it is a new node. Tests assert header node identity only within one language.

### 4.4 Fallbacks and CSP

| Situation | Result |
|---|---|
| No `document.startViewTransition` | React commits immediately (an instant swap); focus still moves to `#content` |
| No `view-transition-class` support | The class selectors don't match; the UA's default crossfade or none applies |
| No JS | Full loads, crossfaded where `@view-transition` with `types` is supported (Chromium 126+, Safari 18.2+), otherwise plain; focus starts at the document |
| Reduced motion | Every change is instant; focus behaves the same |
| CSP | React sets `view-transition-name` and `view-transition-class` through the CSSOM, which `style-src` does not govern; all CSS is in bundled files; no `next.config.ts` change |

---

## 5. Small fixes

### 5.0 Motion plumbing and the e2e harness (T1; Phase 1 depends on these)

**Motion plumbing:**
- `site.css`:
  - `.fnw-calm .fnw-enter, .fnw-calm .fnw-reveal.is-in { animation: none; }`
  - `.fnw-reveal.is-waiting { opacity: 0; }`. `<Motion>` adds `is-waiting` before paint, and only to reveals below the fold, so without JS nothing is ever hidden. `.fnw-js` stays unused.
  - Fixing `.fnw-calm` changes behaviour across the site: entrances stop replaying on revisits. That is the documented intent.
- `src/lib/motion.ts`:
  - `export const LOCALE_PREFIX = \`^/(?:${locales.join('|')})(?=/|$)\``
  - `export const playedKey = (pathname: string) => pathname.replace(new RegExp(LOCALE_PREFIX), '') || '/'`
  - `export const themeFor = (mm: typeof matchMedia) => (mm('(prefers-color-scheme: light)').matches ? 'light' : 'dark')`
  - `export const headScript`, moved here from `[locale]/layout.tsx`. It uses the same prefix and the same theme rule, written out as a string that mirrors `playedKey` and `themeFor`.
- `<Motion>` keeps `decided` keyed by the full pathname but stores and reads `playedKey(pathname)` in sessionStorage. A switch to the other language is then calm.

**The e2e harness:**
- `playwright.config.ts` gains a throwaway mode, switched on by `E2E_PORT`:
  - `use.baseURL = \`http://localhost:${port}\`` with port `E2E_PORT ?? 3000`.
  - With `E2E_PORT` set:
    - `process.env.MEDIA_DIR ??= path.join(os.tmpdir(), 'fnw-e2e-media')`, inherited by the server and by in-process Local API helpers;
    - `webServer: { command: \`pnpm start --port ${port}\`, url, reuseExistingServer: false, env: { DATABASE_URL, PAYLOAD_SEED: 'true', PAYLOAD_SECRET: process.env.PAYLOAD_SECRET || 'e2e-only-secret', SITE_URL: url, MEDIA_DIR } }`.
  - Without it, the current behaviour (`pnpm dev` on :3000, reused) is unchanged.
  - The mode uses a production server because `next dev` holds `.next/dev/lock`, so a second dev server cannot run beside the user's. `next start` warns about `output: 'standalone'` but serves. A fresh database runs the migrations at start, then the seed.
- `tests/e2e/api.e2e.spec.ts` and `tests/e2e/languages.e2e.spec.ts` use relative URLs with `baseURL` instead of hard-coded `localhost:3000`. The languages spec also adds `map` to its raw-key regex.

### 5.1 (a) The four stale clinic e2e specs (T6, separate; not Phase 1)

- `tests/e2e/admin.e2e.spec.ts` keeps the dashboard, user list and new-user tests. It replaces the clinic tests with checks that:
  - `/admin/collections/projects/create` shows `input[name="name"]` and the addresses array;
  - `/admin/globals/studio` shows `input[name="headline"]`;
  - `/admin/collections/short-links/create` shows `input[name="alias"]`.
- `tests/e2e/contact.e2e.spec.ts` keeps the challenge-route test and "offered only while it can send" (`formStarted` is present if and only if `relayReady`). It drops the map, services and phone tests, and adds:
  - with the relay unconfigured, `/en/contact` has no `<form>`;
  - the home band's `Write to me` link points to `/en/contact`.
- `tests/e2e/nojs.e2e.spec.ts` is rewritten. Without JavaScript, at 320, 390 and 768:
  - `/en`, `/en/projects/giogio` and `/en/contact` render;
  - the header's Projects, Contact and EN/HR links are visible;
  - `document.documentElement.scrollWidth <= innerWidth`.
  - The contact form's `needsScript` test is kept and reworded ("how to reach me").
- `tests/e2e/csp.e2e.spec.ts` replaces `demo-logo.svg` with a new helper, `tests/helpers/seedMedia.ts`.
  - In `beforeAll` the helper creates `e2e-probe.svg` through the Local API, and `afterAll` deletes it.
  - The test also checks that `/en`, `/en/projects/giogio` and `/hr` fire no `securitypolicyviolation` (the listener is installed through `addInitScript`).
- All four use relative URLs with `baseURL`.

### 5.2 (b) Short links never shadow pages (T5, separate; not Phase 1)

The rule is checked on both sides, and resolution also prefers the page.
- `src/collections/ShortLinks.ts`: `aliasRule` becomes async. It rejects an alias equal to the slug of **any** page, drafts included, because a draft may be published later. It counts `pages` with `req`.
  - Message: `"/${value}" is a page of this site. Choose another word.` / `"/${value}" je stranica ovog weba. Odaberite drugu riječ.`
- `src/fields/slug.ts`: `slugField(sourceField, reserved, extra?)` gains an optional async `extra(slug, req)` check. `src/collections/Pages.ts` passes one that rejects a slug equal to an existing alias.
  - Message: `"/${slug}" is a short link. Choose another address, or remove the short link first.` / `"/${slug}" je kratka poveznica. Odaberite drugu adresu ili najprije uklonite kratku poveznicu.`
- `src/app/(frontend)/pick-language/route.ts`: when `alias` is set and `(await getPublishedIndex()).pages.has(alias)`, skip `resolveShortLink` and fall through to the language redirect. Pages win, which also covers rows written before the validation existed.
- There is no schema change, so no migration. Admin descriptions are not changed in this task.
- Tests:
  - an alias `about` is refused while page `about` exists;
  - a page whose slug equals an alias is refused;
  - a short link `about` written through `payload.db.create` (bypassing validation), with page `about` published, makes pick-language answer `/about` with a 307 to `/en/about`;
  - `giogio` still redirects.

### 5.3 (c) `siteLinkRule` (T5, separate)

- No field uses it: rich text uses `richTextLinkRule`, and every other link field uses `httpsRule`.
- Remove `siteLinkRule` and its helper `targetExists` from `src/fields/link.ts`, and their tests in `tests/int/links.int.spec.ts`.
- T5 also updates AGENTS.md's link-rule sentence to "checked by shape at save time (`src/fields/link.ts`) and again at render (`resolveLink`)". T5 must land after T7, or coordinate that one line with T7's owner.

---

## 6. Work breakdown

Each task owns its files exclusively. The shared files each have one owner:
- `site.css`, `messages/*.json`, `[locale]/layout.tsx` and `playwright.config.ts` belong to T1;
- the home page and `Signs.tsx` belong to T2;
- `package.json`, `Dockerfile` and `README.md` belong to T3;
- `(site)/layout.tsx` belongs to T4;
- `AGENTS.md` and `.gitignore` belong to T7.

**T1: Foundation (sequential; first; blocks T2, T3 and T4)**
- Owns:
  - `src/app/(frontend)/[locale]/site.css`
  - `src/app/(frontend)/[locale]/layout.tsx`
  - `src/lib/motion.ts`
  - `src/components/Motion.tsx`
  - `src/components/ThemeSync.tsx` (new)
  - `messages/en.json`, `messages/hr.json`
  - the new, empty `src/app/(frontend)/[locale]/{routemap,window,transition}.css`
  - `playwright.config.ts`
  - `tests/e2e/api.e2e.spec.ts`, `tests/e2e/languages.e2e.spec.ts`
  - `tests/int/motion.int.spec.ts`
- Work:
  - the `.fnw-calm` and `.is-waiting` rules;
  - `.site-page` (grid) alongside `.site-main`. Both keep grid rules, so nothing breaks before T4 lands;
  - delete the old `.window*` rules;
  - import the three new CSS files after `site.css`;
  - `playedKey`, `themeFor` and `headScript` in `motion.ts`;
  - `ThemeSync`, mounted in `<body>`;
  - all message keys from 2.9;
  - the e2e harness (5.0).
- Tests:
  - `playedKey('/en') === '/'`, `playedKey('/hr/projects/giogio') === '/projects/giogio'`, `playedKey('/english') === '/english'`;
  - `headScript` evaluated against a stub `document`, `sessionStorage` and `matchMedia` sets `fnw-calm` and `data-theme` exactly as `<Motion>` and `ThemeSync` would;
  - `messages.int.spec.ts` passes unchanged.

**T2: Route map (parallel after T1)**
- Owns:
  - `src/lib/routeMap.ts`
  - `src/components/site/RouteMap.tsx`
  - `src/components/site/Signs.tsx` (extract `StatusIcon`)
  - `src/app/(frontend)/[locale]/routemap.css`
  - `src/app/(frontend)/[locale]/(site)/page.tsx` (mount the map; update the doc comment)
  - `tests/int/routeMap.int.spec.ts`
  - `tests/int/routeMapRender.int.spec.tsx`
  - `tests/e2e/routemap.e2e.spec.ts`
- Depends only on T1. The board rules key on `.site-main`, not `.site-page`.

**T3: Windows (parallel after T1)**
- Owns:
  - `src/collections/Projects.ts`
  - `src/migrations/<ts>_window_address.{ts,json}`, `src/migrations/index.ts`
  - `src/payload-types.ts` (generated)
  - `src/components/site/Window.tsx`
  - `src/app/(frontend)/[locale]/(site)/projects/[slug]/page.tsx`
  - `src/app/(frontend)/[locale]/window.css`
  - `scripts/capture-windows.ts`
  - `src/seed/windowSeeds.ts`, `src/seed/windows/.gitkeep`
  - `src/seed/index.ts`
  - `Dockerfile`, `package.json`, `README.md`
  - `tests/int/deploy.int.spec.ts` (the Dockerfile copies `src/seed/windows`; there is no new environment variable)
  - `tests/helpers/fixtureWindow.ts`
  - `tests/int/windows.int.spec.ts`
  - `tests/e2e/windows.e2e.spec.ts`
- T3 is the only task with a migration.

**T4: Page transition (parallel after T1)**
- Owns:
  - `src/components/site/PageTransition.tsx`
  - `src/app/(frontend)/[locale]/(site)/layout.tsx`
  - `src/app/(frontend)/[locale]/transition.css`
  - `tests/e2e/transition.e2e.spec.ts`

**T7: Integration and verification (sequential; last for Phase 1)**
- Owns:
  - `AGENTS.md`:
    - build-order step 3 status;
    - a note that in this App Router site soft navigations need React's `<ViewTransition>`, and `@view-transition` covers only document loads;
    - the six-line wide-map limit;
    - the focus-on-`#content` rule;
    - the windows policy;
    - the e2e harness command.

    Leave the `next dev` block in place.
  - `.gitignore`: `/test-results/`, `/playwright-report/`.
  - `tests/e2e/visual.e2e.spec.ts`.
- T7 runs every check in section 7 and fixes nothing outside its own files. Failures go back to the owning task.

**Separate, after or beside Phase 1 (they do not block it):**
- **T5: short links and the link rule.**
  - Owns:
    - `src/app/(frontend)/pick-language/route.ts`
    - `src/collections/ShortLinks.ts`, `src/collections/Pages.ts`
    - `src/fields/slug.ts`, `src/fields/link.ts`
    - `tests/int/links.int.spec.ts`, `tests/int/shortLinks.int.spec.ts`
    - the AGENTS.md link-rule line, after T7
  - Runs in parallel with T2 to T4, with no shared files.
- **T6: the stale e2e specs.**
  - Owns:
    - `tests/e2e/{admin,contact,nojs,csp}.e2e.spec.ts`
    - `tests/helpers/seedMedia.ts`
  - Needs T1's harness, then runs in parallel.

**Order:** T1, then T2, T3 and T4 in parallel, then T7. T5 can start at any time. T6 can start after T1. No two tasks share a file.

### Tests owned by T2

`tests/int/routeMap.int.spec.ts` (pure, no database):
- For n = 1..6, `wideMap(n)` returns n lines.
- Every segment is horizontal or exactly 45° (|dx| = |dy| ± 0.01).
- Every path starts at distance R + gap ± 0.01 from the point's centre (−16, 32n).
- Every path ends at (W, 64i + 32.5).
- No two paths intersect (pairwise segment test).
- Adjacent diagonals on the same side are 7 ± 0.01 apart, measured perpendicularly.
- W never decreases as n grows.
- `wideMap(0)` and `wideMap(7)` return null.
- `(fanLength − 1 − runDashOffset) mod 11 === 0`.
- `stopsFor(3)` is `[33.33, 66.67]`, `stopsFor(1)` is `[]`, and `stopsFor(9)` has length 3.
- `MAP.row` equals `--space-section` and `MAP.point` equals `--size-icon-xl`, both parsed from `src/styles/fnw/tokens.css`.
- `routemap.css`:
  - contains the hover and the `a:focus-visible` board rules for every k = 1..`MAP.wideMax`;
  - no selector contains `:has(` twice inside one `:has(…)` argument;
  - no selector names `.site-page`;
  - every board rule names `.map:not(.map--rail)`;
  - every keyframe used by a map part with `--duration-fast` is absent from the draw (a grep that `--duration-fast` appears only in `transition` declarations).

`tests/int/routeMapRender.int.spec.tsx` (`renderToStaticMarkup`, fixture projects, no database):
- Render with `html(await RouteMap({ projects, locale }))`, the same top-level call `emptySite.int.spec.tsx` uses for `Header`.
- Its own `vi.mock('next-intl/server')` loads `messages/${locale}.json` for the locale passed to `getTranslations({ locale, namespace })`. The emptySite mock is English only.
- `@/i18n/navigation` is mocked as in emptySite.
- Assertions:
  - the `<nav>` is named "Route map";
  - there is one `li` per project, in line order, with hrefs `/en/projects/<slug>`;
  - there are no external hrefs;
  - `map-line--dashed` appears exactly when `!isRunning`;
  - the NMT plate reads "Building";
  - the Giogio plate contains "giogio.music" and "2 more addresses" and has 2 `<circle>`s;
  - every `svg` has `aria-hidden="true"` and `focusable="false"`;
  - **no element has a `style` attribute**;
  - seven projects give `map--rail` and no `<svg>`;
  - zero projects render nothing;
  - in hr the plate reads "još 2 adrese", the nav is "Karta linija", and the origin is "Ovdje ste".

`tests/e2e/routemap.e2e.spec.ts`:
- **At 1280, in dark and light:**
  - hovering plate 02 sets the Giogio path's computed `stroke` to the computed `--accent`, and the other paths to `--route-dim`;
  - **hovering board row 3 lights map line 3, and the NMT dashed plate's computed `border-color` equals `--accent` and its number badge has an inset accent ring**;
  - focusing the board's row-3 link with the keyboard does the same;
  - Tab from the skip link reaches the plates in order 01..04, and the focused plate lights its line and shows a 2px outline.
- **"You are here" never collides**, at 1280 and 320, in en and hr:
  - `.map__here`'s bounding box intersects no `.map-line__fan path` box and no `.map-line__run` box;
  - in the rail, its bottom is at or above `.map__lines`' top;
  - it is fully inside the viewport.
- **Text growth at 1280:** after `addStyleTag('.map-plate, .map-plate * { font-size: 24px !important }')`, every plate's box lies within its `li` row and no two plates overlap.
- **At 320, 360 and 390, in en and hr:**
  - the rail shows and there are no SVGs;
  - `scrollWidth <= innerWidth`;
  - for every plate text element, `scrollWidth <= clientWidth` (no truncation);
  - every plate is at least 44px tall.
- **Rail lighting, at 390 with `hasTouch: false`:**
  - focusing plate 03 makes the computed trunk gradient of `li:nth-child(3)::before` start with `--accent` and end with `--route-dim`;
  - lines 1 and 2 are accent throughout;
  - line 4 is dim.
- **No JS:**
  - there are 4 working links;
  - hovering a plate lights its line;
  - clicking a plate opens `/en/projects/<slug>`.
- **Once per visit:**
  - a first `/en` load has running `fnw-draw` animations on `.map` descendants;
  - none run after a reload (and `<html>` has `fnw-calm`), after a soft navigation away and back, or after switching to `/hr`;
  - every running animation under `.map` has an `effect.getTiming().duration` of at least 280.
- **Reduced motion** (`reducedMotion: 'reduce'`): no animations run under `.map`.
- **Forced colours** (`emulateMedia({ forcedColors: 'active' })`), at 1280 and 320:
  - the path stroke, the circle fill and the rail backgrounds resolve to system colours that are not transparent;
  - the point is visible.
- **Touch** (`hasTouch`, 390): tap a plate, then `goBack()`; no line is accent.

### Tests owned by T3

`tests/int/windows.int.spec.ts` (fresh database through `tests/helpers/freshDatabase.ts`):
- `WINDOWS` is empty. After `seed()` with defaults, no project has a window and the seed logs no error.
- With `seed(payload, { windowsDir: tmp, windows: [fixtureEntry] })`, where `makeFixtureWebp(tmp)` writes the file and the entry's address is `https://presstart.giogio.music`:
  - Giogio has a window whose Media alt differs between en and hr;
  - its `windowAddress` is `https://presstart.giogio.music`;
  - its `windowCaption` differs between en and hr;
  - NMT has none.
- With the fixture entry but an empty `windowsDir`, the seed completes and no project has a window.
- Projects validation refuses a `windowAddress` that is not one of the project's addresses, and accepts a padded copy of one.
- Every committed `src/seed/windows/*.webp` (none in Phase 1) is 780×976 and at most 150 KB.
- The existing `migrations.int.spec.ts` passes.

`tests/e2e/windows.e2e.spec.ts` (throwaway mode only; `attachFixtureWindow` in `beforeAll`, `detach` in `afterAll`):
- `/en/projects/giogio` has a `figure.window` inside `.project__facts`, before `.project__exits`.
- Its img alt is the en fixture alt, and `/hr/projects/giogio` shows the hr alt.
- `.window__addr` reads `presstart.giogio.music`, and the bar is `aria-hidden`.
- The figcaption shows the caption.
- The `.window__view` ratio is 0.8 ± 1%.
- The window contains no `<a>`.
- `/en/projects/nmt` has no `.window`.
- At 320 there is no horizontal scroll.
- After `detach()`, `/en/projects/giogio` has no `.window`.

### Tests owned by T4

`tests/e2e/transition.e2e.spec.ts` (Chromium; `addInitScript` wraps `document.startViewTransition` with a call counter):
- **Exactly one call per soft navigation**, for each of:
  - a map plate;
  - a board link;
  - "← All projects";
  - EN→HR;
  - **project A → B**: open `/en`, click plate 01 (`/en/projects/locals`), go back to `/en` with the header logo link, click plate 02 (`/en/projects/giogio`), then `page.evaluate(() => history.go(-2))`. That is one soft popstate from B to A: the counter increases by exactly 1 and the URL ends in `/en/projects/locals`.
- **During `transition.ready`:**
  - `document.getAnimations()` includes opacity animations on `::view-transition-new(*)` and none on `::view-transition-group(fnw-nav)`;
  - `getComputedStyle(document.documentElement, '::view-transition-old(fnw-nav)').display` is `none`.
- **Within one language**, the header's bounding box and node identity (a marker property) do not change.
- **Theme:** with `colorScheme: 'light'`, `<html data-theme>` is still `light` after EN→HR, and also after a soft navigation to a missing project (`/en/projects/nope`).
- **Focus, the decided behaviour:**
  - Enter on a focused board link (keyboard): `document.activeElement.id === 'content'`, and the next Tab focuses an element inside `#content`.
  - Clicking the header's Contact link: `activeElement.id === 'content'`.
  - Clicking EN→HR: `activeElement.id === 'content'` on the remounted `<main>`.
  - `history.go(-2)` (above): `activeElement.id === 'content'`.
  - After a reload (a full load): `activeElement` is `<body>`, and one Tab focuses the skip link.
  - `#content` has no visible outline when focused (`outline-style` is `none`).
- **Reduced motion** (`reducedMotion: 'reduce'`): `transition.finished` resolves within 50ms, no `::view-transition-*` animation runs, and focus still moves to `#content`.
- **No `startViewTransition`:** with `document.startViewTransition` deleted in an init script, navigation still works and focus moves.
- **Cross-document:** an init script records `pagereveal`'s `e.viewTransition` and its `types`. `evaluate(() => location.href = '/en/about')` shows a transition whose types include `fnw-doc`.
- **No console errors** (no AbortError or TimeoutError).

---

## 7. Acceptance checks

Run in this order. The repository has one commit (`f32f29b`), and Phase 1 lands as further commits.

```sh
pnpm install
pnpm lint                     # 0 errors
pnpm typecheck                # 0 errors
pnpm capture:windows          # prints "Nothing to capture…", exits 0

# Commit Phase 1 first, then prove the generated files match the schema.
git add -A && git commit      # (by whoever integrates; message per the repo's convention)
pnpm generate:types && pnpm generate:importmap && pnpm payload migrate:create schema_check --skip-empty
git status --porcelain        # empty: types, import map and migrations match the schema

# Integration tests: a throwaway Postgres (AGENTS.md).
podman run -d --rm --name fnw-test-pg --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=test -p 54329:5432 postgres:17-alpine
DATABASE_URL=postgres://postgres:test@localhost:54329/postgres pnpm test:int   # all green, incl. new specs
podman rm -f -v fnw-test-pg

pnpm build                    # succeeds without a database; safe beside the running dev server

# e2e: a second throwaway Postgres and a production server on :3100, never the user's
# development database or the dev server on :3000.
podman run -d --rm --name fnw-e2e-pg --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=test -p 54330:5432 postgres:17-alpine
E2E_PORT=3100 DATABASE_URL=postgres://postgres:test@localhost:54330/postgres \
  pnpm test:e2e routemap windows transition visual languages api        # all green
podman rm -f -v fnw-e2e-pg
rm -rf "${TMPDIR:-/tmp}/fnw-e2e-media"
```

- The server log of the e2e run shows that the migrations were applied, "Seed: done.", and no "no window for" line, because the manifest is empty.
- `admin`, `contact`, `nojs` and `csp` are T6's and are excluded until T6 lands. Then the e2e line is `pnpm test:e2e` with no filter.

**Screenshots by eye.** `tests/e2e/visual.e2e.spec.ts` writes `test-results/phase1/` screenshots for `/en`, `/hr` and `/en/projects/giogio` (with `attachFixtureWindow`) at 375, 768 and 1280, each with `colorScheme` dark and light. Check:
- **1280:**
  - the wide map sits in the hero after the copy, with "YOU ARE HERE" left of the point;
  - four lines leave the point as a bundle with visible gaps; 01 and 02 peel up, 03 and 04 down;
  - line 03 is dashed, and its plate is an unfilled dashed plate reading "Building";
  - line 02 has two hollow stops, and its plate reads "giogio.music · 2 more addresses";
  - no join shows between fan and run, no run passes under a plate, and the free space falls on the right.
- **768:** the wide map, with no ellipsis on the seeded names.
- **375:** the rail, with the point above and a trunk with spurs (03's spur dashed). Plates are full width with wrapped text and no ellipsis. There is no horizontal scroll.
- **Light theme:** lines are `#75798c`, and accent appears only on lit parts.
- **Project page:** the fixture window, a framed picture above the exit plates, in both station themes.

**Further checks:**
- **Reduced motion** (`reducedMotion: 'reduce'`): the map is complete on first paint, `document.getAnimations()` is empty on `/en`, and page changes are instant.
- **No JS** (`javaScriptEnabled: false`): the map, the board, the window and every link work, and hovering a plate still lights its line.
- **Forced colours:** lines, rail, stops, point and plate edges are all visible.
- **CSP:** `next.config.ts` is unchanged (`git diff f32f29b -- next.config.ts` is empty).
- **Manual, once:** Safari (WebKit) on `/en` and `/en/projects/giogio`.
  - The draw animations are transforms on HTML elements and root `<svg>` elements only (no `clipPath`, no mask), and the base state is the finished map, so the worst case is no animation.
  - Confirm that the subgrid layout, the container query on `.map` and `:has()` lighting work.

---

## 8. Out of scope

- The status check (a Payload job pinging addresses) and real board status: build step 4.
- Share cards with the project's line lit: step 4.
- Shared-element morphs (plate badge → page heading), directional slides and `transitionTypes`: they break "settle, don't fly".
- Live iframes, hand-coded postcards, and a second, light-theme window per project.
- Any committed window capture, until a destination has a published page (or the user accepts a release build; see Decisions).
- Stop labels on the map (the plate text carries the extra addresses), a map legend, and a "Next line" placeholder.
- Board → map lighting with more than six lines, and a wide map with more than six lines (it becomes the rail).
- Growing wide rows to fit text under a large browser minimum font size (wide plates clip to one row; 2.5).
- Seen in passing and left for later:
  - in the light theme, the home `.fnw-band` puts dark text on the indigo `--section`, a design-system (`bundle.css`) issue to report upstream before launch;
  - the header wraps to two rows at 390px.
- `@axe-core/playwright`: a new devDependency needs review under `minimumReleaseAge`.
- Editing `design/` (copied from the design system): the soft-navigation note goes into AGENTS.md here and upstream later.
- A WebKit or Firefox Playwright project in CI (only Chromium is configured).
- T5 and T6 belong to separate changes, though they are specified above.

---

## Critic notes

I checked every gap against the code. All are accepted and closed above. Three of them need a qualification:
- **Acceptance order.** The directory is now a git repository with one commit (`f32f29b`, "Scaffold fromnowhere.dev on the NMT-PublicWeb base"), so `git status` is meaningful today. The point still stands: Phase 1 must be committed before the generator check, and section 7 now says so.
- **The "MUST" wording.** The quoted rules (entrances at slow or slower; a real capture of a real, published page; the bounding-box test for "You are here") come from the sceptics' MUST lists, not verbatim from `design/*.md`. motion.md's principle 3 and its duration table ("duration-fast … every exit", "duration-slow … Entrances") back the duration rule. I hold the spec to all three.
- **The unsafe acceptance step.** It was worse than reported. `next dev` takes `.next/dev/lock` (`setup-dev-bundler.js:175`), so a second dev server in this directory would refuse to start. The e2e harness therefore runs a production server (`next start`, port 3100) against a throwaway Postgres, with `MEDIA_DIR` in a temp directory. Every existing spec hard-codes `localhost:3000`, so T1 moves the Phase 1 specs to `baseURL` and T6 moves the rest.
