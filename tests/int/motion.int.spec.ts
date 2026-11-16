import { describe, expect, it } from 'vitest'

import { headScript, isCalm, PLAYED_KEY, playedKey, readPlayed, themeFor } from '@/lib/motion'

/**
 * Entrances play once per page per visit, and the theme follows the device. Two pieces of code make
 * that call: the head script before first paint, and <Motion> and <ThemeSync> once React is awake
 * (src/lib/motion.ts). They must agree, or a page would flash its entrance or its theme.
 */

describe('playedKey', () => {
  it('is the same page in every language', () => {
    expect(playedKey('/en')).toBe('/')
    expect(playedKey('/hr')).toBe('/')
    expect(playedKey('/hr/projects/giogio')).toBe('/projects/giogio')
    expect(playedKey('/en/projects/giogio')).toBe('/projects/giogio')
    expect(playedKey('/en/contact')).toBe('/contact')
  })

  it('leaves alone an address that only starts like a language', () => {
    expect(playedKey('/english')).toBe('/english')
    expect(playedKey('/hrvatski/en')).toBe('/hrvatski/en')
    expect(playedKey('/')).toBe('/')
  })
})

describe('themeFor', () => {
  it('is light only when the device asks for it', () => {
    expect(themeFor(stubMatchMedia({ light: true }))).toBe('light')
    expect(themeFor(stubMatchMedia({ light: false }))).toBe('dark')
  })
})

type Device = { light?: boolean; reduce?: boolean }

const stubMatchMedia = ({ light = false, reduce = false }: Device) =>
  ((query: string) => ({
    matches:
      (query === '(prefers-color-scheme: light)' && light) ||
      (query === '(prefers-reduced-motion: reduce)' && reduce),
  })) as unknown as typeof matchMedia

type Storage = string | null | 'throws'

/** Runs the head script against stubs and reports what it did to <html>. */
const runHeadScript = (pathname: string, stored: Storage, device: Device) => {
  const classes = new Set<string>()
  const html = {
    dataset: { theme: 'dark' } as Record<string, string>,
    classList: { add: (name: string) => classes.add(name) },
  }
  const sessionStorage = {
    getItem: (key: string) => {
      if (stored === 'throws') throw new Error('SecurityError')
      return key === PLAYED_KEY ? stored : null
    },
  }
  new Function('document', 'location', 'sessionStorage', 'matchMedia', headScript)(
    { documentElement: html },
    { pathname },
    sessionStorage,
    stubMatchMedia(device),
  )
  return { theme: html.dataset.theme, calm: classes.has('fnw-calm') }
}

/** What <ThemeSync> and <Motion> decide for the same page, through the very helpers they call. */
const reactDecides = (pathname: string, stored: Storage, device: Device) => {
  const mm = stubMatchMedia(device)
  const played = readPlayed(() => {
    if (stored === 'throws') throw new Error('SecurityError')
    return stored
  })
  return { theme: themeFor(mm), calm: isCalm(pathname, played, mm) }
}

describe('readPlayed and isCalm', () => {
  it('counts blocked, missing or garbled storage as nothing played', () => {
    expect(readPlayed(() => null)).toEqual([])
    expect(readPlayed(() => 'not json')).toEqual([])
    expect(readPlayed(() => JSON.stringify('/'))).toEqual([])
    expect(
      readPlayed(() => {
        throw new Error('SecurityError')
      }),
    ).toEqual([])
    expect(readPlayed(() => JSON.stringify(['/']))).toEqual(['/'])
  })

  it('is calm for a page played in either language, or under reduced motion', () => {
    expect(isCalm('/hr/projects/giogio', ['/projects/giogio'], stubMatchMedia({}))).toBe(true)
    expect(isCalm('/en', ['/projects/giogio'], stubMatchMedia({}))).toBe(false)
    expect(isCalm('/en', [], stubMatchMedia({ reduce: true }))).toBe(true)
  })
})

describe('the head script', () => {
  const paths = ['/en', '/hr', '/en/projects/giogio', '/hr/projects/giogio', '/english', '/hr/']
  const stores: Storage[] = [
    null,
    '[]',
    JSON.stringify(['/']),
    JSON.stringify(['/projects/giogio']),
    JSON.stringify(['/english']),
    'not json',
    JSON.stringify('/'),
    JSON.stringify({ '/': true }),
    '5',
    'throws',
  ]
  const devices: Device[] = [{}, { light: true }, { reduce: true }, { light: true, reduce: true }]

  it('sets fnw-calm and data-theme exactly as <Motion> and <ThemeSync> would', () => {
    for (const pathname of paths) {
      for (const stored of stores) {
        for (const device of devices) {
          expect(
            runHeadScript(pathname, stored, device),
            `${pathname} ${stored} ${JSON.stringify(device)}`,
          ).toEqual(reactDecides(pathname, stored, device))
        }
      }
    }
  })

  it('keeps a page calm in the other language once it has played', () => {
    const stored = JSON.stringify([playedKey('/en/projects/giogio')])
    expect(runHeadScript('/hr/projects/giogio', stored, {}).calm).toBe(true)
    expect(runHeadScript('/en', stored, {}).calm).toBe(false)
  })

  it('still follows the device when sessionStorage is unavailable', () => {
    expect(runHeadScript('/en', 'throws', { light: true, reduce: true })).toEqual({
      theme: 'light',
      calm: true,
    })
  })
})
