# Patterns

Three kinds of site use this system. All three share the same tokens and components. They differ in how much brand shows.

## Studio and portfolio (fromnowhere.dev)
1. `Nav` with the 28px `Lockup`, three or four links ("Projects", "Writing", "About") and one primary action ("Get in touch").
2. `Hero` with the full `Lockup` as `brand`, a kicker, one headline sentence, a lede and two actions.
3. Numbered sections: `SectionHeading number="01" kicker="Projects"`, then a grid of `Card href` with `space-4` gaps. Each card shows the project name, one sentence and a meta row of stack `Tag`s.
4. At most one `.fnw-band` (the `section` indigo) per page, for the strongest proof, such as a shipped-project count. Use real numbers only.
5. `Footer` with `attribution={false}` and the full lockup or contact line in the main slot.
6. Motion: the hero's lockup uses `animate`, and its copy uses `.fnw-enter` with `--i` 0–3. Each section's heading and card grid are wrapped in `Reveal`, with the cards indexed in order.

## Apps and tools
- The app shell is `Nav` (the product wordmark as `brand`, plus icon-button actions), with the content below at `space-8` gutters. There's no hero.
- Use `Tabs` for sections within a screen, `Segmented` for view switches, `Table` for records, and `Card` for summaries.
- Forms always use `Field` with a label. One primary `Button` per screen goes at the end of the form, and the other buttons are secondary.
- Use `Alert` inline for status and `Dialog` only for decisions that are destructive or can't be undone.
- Offer a theme `Switch` in settings, defaulting to dark or to the OS setting.
- Motion is limited to state transitions, dialogs, alerts and the `Loader`. Don't use scroll reveals or the logo assemble here.

## Community sites (for example tournaments and clubs)
- The community has its own wordmark in `Nav`. The Fromnowhere monogram appears only in the `Footer` attribution.
- The `Hero` holds the next event: what it is, when it is and the "Register" primary action. Put a `Tag tone="warning"` on it when spots are running out.
- Use `Table` for standings and pairings, with `mono` for records and `align="end"` for points. Use an `Avatar` with initials for players without a photo.
- Show event lists as `Card`s with a calendar icon in the meta row. Show results as `Tabs`: "Overview", "Pairings", "Standings", "Decklists".
- Member-written content can be informal. The interface around it stays in the system's plain voice.
- Motion: reveal the event cards and standings sections on the home page with `Reveal`. Pages people check every week, like pairings, show their content immediately.

## Page skeleton (plain HTML)
```html
<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
  <link rel="stylesheet" href="/fnw/tokens.css">
  <link rel="stylesheet" href="/fnw/bundle.css">
</head>
<body>
  <header class="fnw-nav">…</header>
  <main style="padding: 0 var(--space-8); display: grid; gap: var(--space-section); max-width: 1120px">…</main>
  <footer class="fnw-footer">…</footer>
</body>
</html>
```
