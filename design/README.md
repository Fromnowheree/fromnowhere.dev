Fromnowhere is an independent software studio at **fromnowhere.dev**. It makes apps, developer websites and community sites, all built from this one system. The identity is made of the same parts as the work: solid plates that never touch, one accent point and a quiet dark ground. Everything here should look calm, compact and deliberate. It should never be loud.

## Using this system

- Link `tokens.css`, then `components/bundle.css`, on every page. Take every color, size, space, radius and shadow from the token variables (`var(--ground)`, `var(--space-4)`, `var(--radius-md)`, `var(--shadow-sm)`). Never hard-code a hex value or a pixel size that a token already holds.
- **Dark is the primary theme**, and light is its pair. Set `<html data-theme="dark">` or `data-theme="light"`. The first theme is the fallback. If you follow the OS setting, use `prefers-color-scheme` to set the attribute, and save the user's choice when they flip the theme Switch.
- **React apps** load React 18 and then `components/bundle.js`, which exposes `window.Fromnowhere` (`Button`, `Field`, `Nav` and the rest). **Plain HTML sites** use the same `fnw-` classes directly; each component's guidelines show the markup.
- Type is **Inter** at 400 and 500 only. The files are in `fonts/` and have full Latin Extended coverage, so č, ć, š, ž and đ render correctly. Code uses the system monospace.
- Build with the components before inventing new ones. If you need a new pattern, build it from the same tokens and add it here.

## Content fundamentals

- **Voice:** plain, short and declarative. Say what a thing does, then stop. Write "Pairings are up", not "Exciting news — pairings are finally here!"
- **Person:** apps talk to the user as *you*. Studio pages speak as *Fromnowhere* or *I*, never a corporate *we*.
- **Case:** use sentence case for headings, buttons and labels. Use caps only for kickers, table headers and the FROMNOWHERE line under the monogram, and track them 0.08–0.1em.
- **Name:** the name is **Fromnowhere**: one word, with a capital F only. The monogram is **FNW**. Never write "From Nowhere" or "FromNowhere".
- **Buttons** start with a verb: "Save changes", "Register for Saturday", "Copy link". Errors say what to do: "Use at least 8 characters".
- **No exclamation marks, no emoji in interface text, no filler stats.** Community content written by members can use emoji. The surrounding chrome stays plain.
- **Numbers:** use numerals ("3 rounds", "32 players") and tabular figures in tables.

## Visual foundations

### Color
- **Proportion:** roughly 70% `ground`, 18% `surface`, 9% `text` and 3% `accent`. If a layout feels purple, it is wrong.
- **The accent is a line, a point or a glow. It is never a flood.** Use `accent` for outlines, the logo point, focus rings, icons that mark state and large type. Use `accent-text` for accent at UI text size, such as primary button labels or the current nav item. Use `link` for paragraph links and kickers. Use `accent-tint` and `accent-tint-strong`, with `accent-tint-ink` text on top, for tinted fills.
- The only solid accent fills are the small controls: a checked checkbox, a selected radio dot, an on switch. Their marks use `on-accent`.
- Use `text-muted` for secondary copy. Use `divider` for decorative hairlines. Use `border-control` wherever a user needs to find the edge of a field.
- **Status** colors are `success`, `warning` and `danger`, each with a `-tint`. They are an addition to the brand palette, kept desaturated so they sit beside the accent. Success leans toward teal, away from the red–green axis. Every status color is paired with an icon and a word, so nothing relies on color alone.
- **Presence:** the `section` indigo band, with a `section-glow` bloom, is the one saturated field allowed. Use one per page at most, for a stat band or a deck divider.
- **Never use pure black or pure white.** Every value comes from the two nine-step ramps (`neutral-100…900`, `accent-100…900`), which share one lightness scale.
- **Contrast:** every text token meets 4.5:1 on the grounds its note names, in both themes. Controls, focus rings and icons meet 3:1.

### Type
- Use Inter 500 for headings, UI labels and the monogram letters, and Inter 400 for everything else. Never go heavier than 500 and never use italics. Hierarchy comes from size and space.
- The scale is `display` 56, `h1` 42, `h2` 32, `h3` 25, `h4` 20, `title` 17, `h5` 16, `h6` 13 (caps). Text sizes are `body` 15/1.55, `body-sm` 13, `ui` 14, `caption` and `label` and `kicker` 11, and `code` 13.
- Headings have −0.015em tracking, and `display` has −0.03em. Use `text-wrap: balance` on headings and `pretty` on paragraphs.

### Space, layout and shape
- **Density 0.7×:** `space-1` to `space-8` (2.8 to 22.4px) are the brand's 4/8/12/16/24/32 steps at 0.7×. This system is dense on purpose. Use `space-section` (64px) between page sections and `space-page` (96px) at the foot of long pages.
- **Layouts are left-aligned and asymmetric.** Headings sit flush left, and content hugs the left edge with whitespace on the right. Never centre a hero.
- Measures: ledes run at most 52–56ch, and hero titles at most 22ch. Pages max out around 1120px.
- **Radii:** `radius-sm` 4 for small marks, `radius-tag` 6, `radius-md` 8 for controls and cards, `radius-lg` 14 for panels, heroes and dialogs, and `radius-round` for avatars and radios.
- **Rules fade to transparent over 48px at both ends.** This is a signature: use `Rule`, the table rows, the tab track and the footer line. Box outlines and short accent marks stay solid. Prefer whitespace over rules.

### Depth and surfaces
- Elevation is an edge plus ambient darkness. `shadow-sm` is a hairline for resting panels, `shadow-md` lifts menus and hovered cards, and `shadow-lg` is for dialogs. Never stack shadows and never add glows to the logo.
- Large surfaces get soft depth from a radial gradient that lifts `surface` into `ground` from the top-left, as in `Hero` and the panel `Card`. Never use flat bright fills or blue-purple gradients.

### Imagery
- Run photographs through `Photo`. Its `lighten` blend lets anything darker than the page fall away, so the image sits in the ground. Prefer subjects shot on dark or black backgrounds. The light theme turns the blend off.
- Don't use stock smiles or decorative illustrations of people. The one illustrative motif is **the point**: a solid accent circle, which can be ringed with the ground.

### States and motion
- Hover is a 7% `text` tint on neutral controls, or a 12% `accent` tint on accent ones. Pressed is 14% or 22%. Keyboard focus is a solid 2px `focus-ring` at a 2px offset. Disabled drops to `opacity-disabled`. `::selection` uses `selection`.
- **Motion:** separate parts arrive and settle, with the gaps intact. State changes use `duration-fast` or `duration-base` with `ease-standard`. Entrances use `duration-slow` with `ease-enter` and travel `distance-sm` or `distance-md`. Nothing bounces, and exits are faster than entrances. Scroll reveals (`Reveal`) and the logo assemble (`Mark animate`) are for sites, not apps. `prefers-reduced-motion` removes all travel. The Motion section has the full rules.

## Iconography

- Use **Phosphor, Regular weight**, inlined as SVG on `currentColor`. `Icon` bundles 47 common glyphs, and the Icons asset group holds the same files for reference. For anything else, use `@phosphor-icons/react` or `@phosphor-icons/web` at Regular.
- Use sizes 16, 20 and 24 in interfaces and 32 in marketing. Icons take the text color. Accent marks state, such as active, selected or done, and never decoration.
- Don't use filled or duotone weights, except for state dots. Don't use emoji as icons.

## Assets

- **Logos:** the monogram in tile-dark (the default), tile-light and tile-accent, plus untiled color and mono versions. Each comes as SVG and PNG.
- **Lockups:** primary (tile + FNW) and full (+ FROMNOWHERE), for dark and light grounds.
- **Favicons:** an SVG favicon, PNGs at 16, 32 and 48, an Apple touch icon (180) and an app icon (1024).
- **Social:** avatars (400, circle-safe) for dark and light, and the 1500×500 banner.
- **Icons:** the bundled Phosphor set.

The Logo section has the usage rules. The Motion section covers animation. The Patterns section shows how to put a page together for a studio site, an app or a community site.
