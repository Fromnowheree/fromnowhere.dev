# Motion

Fromnowhere's motion comes from the mark itself: **separate parts arrive and settle, with the gaps intact.** Things travel a short way, slow down into place and stop. Nothing bounces, spins, loops for decoration or flies in from off-screen. Motion explains what changed. It is never there to entertain.

## Principles
1. **Settle, don't fly.** Elements travel `distance-sm` (4px) or `distance-md` (8px), and `distance-lg` (16px) is the ceiling. All curves decelerate into rest, with no overshoot and no springs.
2. **Parts arrive separately.** When several things enter together, they stagger by `duration-stagger` (60ms) in reading order: kicker, then heading, then content. Stagger at most 6 items.
3. **Exits are faster than entrances.** Leaving uses `duration-fast` with `ease-exit`, or is instant. Never make someone wait for something to go away.
4. **Apps change state, sites make entrances.** In apps, motion is limited to state transitions: hover, toggles, dialogs and alerts. Scroll reveals and the logo assemble belong to marketing, portfolio and community pages.
5. **Once is enough.** A reveal plays the first time content scrolls into view. The logo assembles once per page, at most.
6. **Focus is never animated.** The focus ring appears instantly, and pressed states respond instantly.

## Tokens
| Token | Value | Use |
| --- | --- | --- |
| `duration-fast` | 120ms | Hover, press, colour and border changes; every exit |
| `duration-base` | 180ms | Control state: switch knob, checkbox tick, tab underline, segmented selection |
| `duration-slow` | 280ms | Entrances: dialogs, alerts, menus, scroll reveals |
| `duration-slower` | 480ms | Once-per-page moments: logo assemble, a hero settling, a rule drawing |
| `duration-stagger` | 60ms | Delay between staggered siblings |
| `duration-loop` | 1400ms | One Loader cycle |
| `ease-standard` | cubic-bezier(0.2, 0, 0, 1) | State changes on screen |
| `ease-enter` | cubic-bezier(0, 0, 0.2, 1) | Arrivals |
| `ease-exit` | cubic-bezier(0.4, 0, 1, 1) | Departures |
| `ease-settle` | cubic-bezier(0.16, 1, 0.3, 1) | The brand curve: a long, quiet tail into place |
| `ease-linear` | linear | Loops and progress only |

## What moves, and how
| Element | Motion | Tokens |
| --- | --- | --- |
| Buttons, links, inputs, tags | Colour, background, border and shadow transition | `duration-fast`, `ease-standard` |
| Checkbox, radio, switch, tabs, segmented | Fill and outline transition; the switch knob slides; the tick scales in | `duration-base`, `ease-standard` / `ease-settle` |
| Link cards | The shadow deepens to `shadow-md`; the card itself doesn't move | `duration-base` |
| Dialog | The scrim fades; the panel lifts `distance-sm` from 98% scale. Closing is instant | `duration-slow`, `ease-enter` |
| Alert | Lifts `distance-sm` and fades in | `duration-slow`, `ease-enter` |
| `Reveal` / `.fnw-reveal` | Fades and rises `distance-md` on first view, staggered | `duration-slow`, `ease-enter`, `duration-stagger` |
| `.fnw-enter` | The same, on page load instead of on scroll (a hero's copy) | as above |
| `.fnw-rule--draw` | The rule draws from the left | `duration-slower`, `ease-settle` |
| `Mark animate` / `Lockup animate` | The stem rises, the bars slide in, the point arrives last, then the letters | `duration-slower`, `ease-settle`, `duration-stagger` |
| `Loader` | The plates brighten in sequence; the point holds still | `duration-loop` |

## Never
- Bounce, elastic or spring easing, or any overshoot.
- Parallax, scroll-jacking, or content that moves while someone is reading it.
- Looping decoration: pulsing buttons, floating shapes, animated gradients. The Loader is the only loop.
- Rotating, flipping or 3D-tilting cards, or rotating the logo.
- Typewriter text or counting-up numbers.
- Animating layout properties (width, height, top, left). Animate `transform` and `opacity` only.

## Reduced motion
`bundle.css` honours `prefers-reduced-motion: reduce` globally. Travel and stagger are removed, entrances and reveals appear immediately, and transitions become instant. The Loader keeps pulsing in place, because it is an opacity change with no travel. Custom animations must use the motion tokens, and they must also stop under this query.

## Page transitions (opt-in)
On multi-page sites, enable the browser's cross-document view transitions for a quiet crossfade between pages. Add this to the site's own stylesheet:
```css
@view-transition { navigation: auto; }
::view-transition-old(root), ::view-transition-new(root) {
  animation-duration: var(--duration-slow);
  animation-timing-function: var(--ease-standard);
}
```
To keep the header still across pages, give the `Nav` `view-transition-name: fnw-nav`. Browsers without support simply navigate.

## Writing your own
Build any new animation from the tokens: a duration from `duration-*`, a curve from `ease-*` and a travel from `distance-*`. Use `transform` and `opacity` only. If a motion doesn't explain a change, cut it.
