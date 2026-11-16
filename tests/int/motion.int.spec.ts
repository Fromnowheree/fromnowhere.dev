import { describe, expect, it } from 'vitest'

import { headScript, isCalm, PLAYED_KEY, playedKey, readPlayed } from '@/lib/motion'

/**
 * The other pages' entrances play once per page per visit (the home page's opening plays on every
 * visit and never reads this; tests/int/routeMap.int.spec.ts holds its stylesheet to that). Two
 * pieces of code make the call: the head script before first paint, and <Motion> once React is
 * awake (src/lib/motion.ts). They must agree, or a page would flash its entrance. The site is dark
 * only, so nothing sets a theme.
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
  const dataset: Record<string, string> = {}
  const html = { dataset, classList: { add: (name: string) => classes.add(name) } }
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
  return { calm: classes.has('fnw-calm'), classes: [...classes], dataset }
}

/** What <Motion> decides for the same page, through the very helpers it calls. */
const reactDecides = (pathname: string, stored: Storage, device: Device) => {
  const mm = stubMatchMedia(device)
  const played = readPlayed(() => {
    if (stored === 'throws') throw new Error('SecurityError')
    return stored
  })
  return isCalm(pathname, played, mm)
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

  it('sets fnw-calm exactly as <Motion> would', () => {
    for (const pathname of paths)
      for (const stored of stores)
        for (const device of devices)
          expect(
            runHeadScript(pathname, stored, device).calm,
            `${pathname} ${stored} ${JSON.stringify(device)}`,
          ).toBe(reactDecides(pathname, stored, device))
  })

  it('sets no theme and nothing but fnw-calm, whatever the device asks for', () => {
    for (const device of devices) {
      const result = runHeadScript('/en/contact', null, device)
      expect(result.dataset).toEqual({})
      expect(result.classes.filter((name) => name !== 'fnw-calm')).toEqual([])
    }
    expect(headScript).not.toMatch(/prefers-color-scheme|theme/)
  })

  it('keeps a page calm in the other language once it has played', () => {
    const stored = JSON.stringify([playedKey('/en/projects/giogio')])
    expect(runHeadScript('/hr/projects/giogio', stored, {}).calm).toBe(true)
    expect(runHeadScript('/en', stored, {}).calm).toBe(false)
  })

  it('still follows reduced motion when sessionStorage is unavailable', () => {
    expect(runHeadScript('/en', 'throws', { reduce: true }).calm).toBe(true)
    expect(runHeadScript('/en', 'throws', {}).calm).toBe(false)
  })
})
