import { locales } from '@/i18n/locales'

/** sessionStorage key listing the pages whose entrances have played this visit. */
export const PLAYED_KEY = 'fnw-played'

/** A leading language segment (`/en`, `/hr/…`), and nothing that merely starts like one
 * (`/english`). */
export const LOCALE_PREFIX = `^/(?:${locales.join('|')})(?=/|$)`

/**
 * The page a visitor has seen, the same in every language: `/hr/projects/giogio` and
 * `/en/projects/giogio` are one page, so switching languages does not replay its entrances.
 */
export const playedKey = (pathname: string) =>
  pathname.replace(new RegExp(LOCALE_PREFIX), '') || '/'

/**
 * The pages played this visit, from whatever `read` returns for `PLAYED_KEY`. Storage that is
 * blocked, missing or garbled counts as nothing played.
 */
export const readPlayed = (read: () => string | null): string[] => {
  try {
    const played: unknown = JSON.parse(read() || '[]')
    return Array.isArray(played) ? played : []
  } catch {
    return []
  }
}

/**
 * Whether a page shows everything at once: already played this visit, or reduced motion. This
 * governs the `.fnw-enter` and `.fnw-reveal` entrances of the other pages only: the home page's
 * opening (routemap.css) never reads `fnw-calm` and plays on every visit, and reduced motion stops
 * it through its own media query.
 */
export const isCalm = (pathname: string, played: string[], mm: typeof matchMedia): boolean =>
  played.includes(playedKey(pathname)) || mm('(prefers-reduced-motion: reduce)').matches

/**
 * Runs in <head> before paint (`[locale]/layout.tsx`). It makes the call <Motion> makes once React
 * is awake, written out by hand: `fnw-calm` by `readPlayed` and `isCalm` (a page already seen this
 * session, by `playedKey`, or reduced motion). Keep them in step (tests/int/motion.int.spec.ts).
 * There is no theme to set: the site is dark only.
 */
export const headScript =
  `(function(d){` +
  `try{var c=matchMedia('(prefers-reduced-motion: reduce)').matches;` +
  `try{var k=location.pathname.replace(new RegExp(${JSON.stringify(LOCALE_PREFIX)}),'')||'/';` +
  `var p=JSON.parse(sessionStorage.getItem(${JSON.stringify(PLAYED_KEY)})||'[]');` +
  `if(Array.isArray(p)&&p.indexOf(k)>-1)c=true}catch(e){}` +
  `if(c)d.classList.add('fnw-calm')}catch(e){}` +
  `})(document.documentElement)`
