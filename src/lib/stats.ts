/**
 * Actions counted in the optional visitor statistics (Umami). When statistics are on, the privacy
 * page lists them; keep that list in step with this one. The names are stable
 * identifiers, the same whatever language the page is in.
 */
export type StatsEvent = 'email' | 'exit' | 'enquiry-sent'

/**
 * Spread onto a link or button; StatsClicks counts the click. Not Umami's own `data-umami-event`:
 * its handler holds back links until the stats request finishes, which delays calls and pages.
 * `place` tells apart buttons on the same page (e.g. the bottom bar and the footer).
 */
export const statsEvent = (name: StatsEvent, place?: string) => ({
  'data-stats-event': name,
  'data-stats-place': place,
})

declare global {
  interface Window {
    umami?: { track: (event: StatsEvent, data?: Record<string, string>) => void }
  }
}

/** Does nothing when the script is off, blocked or not loaded yet. */
export const trackStatsEvent = (name: StatsEvent, data?: Record<string, string>) =>
  window.umami?.track(name, data)
