# Logo

## The idea
The monogram is a single F made from three separate plates: the stem, the top bar and the mid bar. Below them sits one point. The gaps are the idea: separate parts that sit on one platform. The point is the accent's only appearance in the mark, and it marks the place everything starts from.

## Construction
- It is drawn on a 64-unit square. The plates are 11 units thick with 1.5-unit corners, and every gap is 4 units. The point has a radius of 5.5 and is centred under the start of the mid bar.
- The tile's corner radius is 0.18 × the tile (`radius-tile`), and the mark fills 75% of the tile.
- Don't redraw the mark. Scale the master files in the Logos group, or use `Mark`, which carries the exact geometry.

## Versions
| Use | Version | Component | Files |
| --- | --- | --- | --- |
| Headers, decks, signage | Primary lockup: tile + FNW | `Lockup` | `Lockups/fnw-lockup-primary-*` |
| Cards, legal footers, first contact | Full lockup: + FROMNOWHERE | `Lockup full` | `Lockups/fnw-lockup-full-*` |
| App chrome, favicons | Surface tile | `Mark` | `Logos/fnw-mark-tile-dark*`, `tile-light*` |
| Avatars, app icons | Accent tile | `Mark variant="accent"` | `Logos/fnw-mark-tile-accent*` |
| Inside a hero, on a card back | Untiled color | `Mark variant="flat"` | `Logos/fnw-mark-color-on-*` |
| Print, engraving, embroidery, anything under 20px | Mono | `Mark variant="mono"` | `Logos/fnw-mark-mono-*` |

On light grounds, the plates are `neutral-900`, the point is `accent-600`, and the tile is `neutral-100` with a `neutral-300` hairline. The tokens `logo-tile`, `logo-plate` and `logo-point` switch these for you.

## Lockup rules
- The tile and the letters share one baseline, and the gap between them is 0.19 × the tile.
- FNW is Inter 500, tracked +0.06em, at 0.46 × the tile height. Never use another face, and never use bold.
- Under the monogram, FROMNOWHERE is in caps, tracked +0.08em, in `text-muted`. In running text the name is "Fromnowhere": sentence case, heading weight.

## Clear space and size
- Keep a quarter of the tile clear on every side.
- The tiled mark is 20px minimum on screen and 6mm in print. Below 20px, use the untiled mono mark. The 16px favicon is mono.

## Don't
- Rotate, skew or stretch it.
- Close the gaps between the plates.
- Flood the tile with `accent`.
- Put type inside the tile.
- Add heavy shadows, glows or gradients to the mark.
- Recolor the plates in anything but `text`, or `accent-200` on the accent tile.

## Sub-brands: apps and community sites
Products and community sites get their **own name**, set as a plain wordmark in Inter 500 at heading tracking, for example "TCG Locals" or "fnw-cli". They share the system's tokens and components. The Fromnowhere monogram does not lead on these sites. It appears once, in the `Footer` attribution ("A Fromnowhere project", with the 16px mono mark), linking to fromnowhere.dev. Don't build sub-brand marks from the plates.
