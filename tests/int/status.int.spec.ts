import { describe, expect, it } from 'vitest'

import { guardedFetch, isProbeable, isPublicIp, probe } from '@/lib/probe'
import { answers, DOWN_AFTER, serviceOf, STALE_MS, withService } from '@/lib/status'
import type { Project } from '@/payload-types'

/**
 * The status check, without the network or a database: how a line's live status follows from what
 * the check heard (src/lib/status.ts), and how one knock on an address is made (src/lib/probe.ts).
 * The job itself, against a real database, is in statusCheck.int.spec.ts.
 */

const NOW = Date.parse('2026-11-16T12:00:00.000Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()

const project = (status: Project['status'], urls: string[]): Project =>
  ({
    id: 1,
    name: 'Giogio',
    slug: 'giogio',
    line: 2,
    status,
    kind: 'music',
    summary: 'x',
    addresses: urls.map((url, i) => ({ id: String(i), url })),
    updatedAt: ago(0),
    createdAt: ago(0),
  }) as Project

describe('answers', () => {
  it('trusts a fresh check: an address is down only after DOWN_AFTER misses in a row', () => {
    expect(answers({ failures: 0, checkedAt: ago(60_000) }, NOW)).toBe(true)
    expect(answers({ failures: DOWN_AFTER - 1, checkedAt: ago(60_000) }, NOW)).toBe(true)
    expect(answers({ failures: DOWN_AFTER, checkedAt: ago(60_000) }, NOW)).toBe(false)
  })

  it('says nothing without a check, or with one too old (or from the future) to go by', () => {
    expect(answers(undefined, NOW)).toBeNull()
    expect(answers({ failures: 5, checkedAt: ago(STALE_MS + 1) }, NOW)).toBeNull()
    expect(answers({ failures: 5, checkedAt: ago(-STALE_MS - 1) }, NOW)).toBeNull()
    expect(answers({ failures: 5, checkedAt: 'not a date' }, NOW)).toBeNull()
  })
})

describe('withService', () => {
  const down = { failures: DOWN_AFTER, checkedAt: ago(60_000) }
  const up = { failures: 0, checkedAt: ago(60_000) }
  const urls = ['https://giogio.music', 'https://prod.giogio.music']

  it('delays a running line whose first address is not answering', () => {
    const live = withService(project('running', urls), new Map([[urls[0], down]]), NOW)
    expect(live.service).toBe('delayed')
    expect(serviceOf(live)).toBe('delayed')
    expect(live.unanswered).toEqual([urls[0]])
  })

  it('keeps it running when only a further stop is quiet, and names that stop', () => {
    const live = withService(
      project('running', urls),
      new Map([
        [urls[0], up],
        [urls[1], down],
      ]),
      NOW,
    )
    expect(live.service).toBe('running')
    expect(live.unanswered).toEqual([urls[1]])
  })

  it('never delays a line the editor did not set running, and invents nothing without checks', () => {
    for (const status of ['building', 'planned', 'paused'] as const) {
      expect(withService(project(status, urls), new Map([[urls[0], down]]), NOW).service).toBe(
        status,
      )
    }
    expect(withService(project('running', urls), new Map(), NOW).service).toBe('running')
    expect(withService(project('running', []), new Map(), NOW).service).toBe('running')
    const stale = { failures: 9, checkedAt: ago(STALE_MS + 60_000) }
    expect(withService(project('running', urls), new Map([[urls[0], stale]]), NOW)).toMatchObject({
      service: 'running',
      unanswered: [],
    })
  })

  it('falls back to the editor’s status where no check was consulted', () => {
    expect(serviceOf(project('paused', urls))).toBe('paused')
  })
})

describe('isProbeable', () => {
  it('knocks only on public https names', () => {
    expect(isProbeable('https://giogio.music')).toBe(true)
    expect(isProbeable('https://www.gati.hr/path?x=1')).toBe(true)
    for (const address of [
      'http://giogio.music',
      'https://localhost',
      'https://localhost:3000',
      'https://app.localhost',
      'https://127.0.0.1',
      'https://10.0.0.5',
      'https://[::1]',
      'https://db',
      'https://printer.local',
      'https://router.lan',
      'https://box.internal',
      'https://nas.home.arpa',
      'https://user:pass@giogio.music',
      'mailto:hello@fromnowhere.dev',
      'not an address',
    ]) {
      expect(isProbeable(address), address).toBe(false)
    }
  })
})

describe('isPublicIp', () => {
  it('accepts public addresses and refuses every internal, reserved or mapped form', () => {
    for (const ip of ['91.234.46.60', '1.1.1.1', '2a01:4f8:c0c:1234::1', '::ffff:8.8.8.8'])
      expect(isPublicIp(ip), ip).toBe(true)
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.20.0.5',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '255.255.255.255',
      '::1',
      '::',
      'fd00::1',
      'fe80::1',
      'ff02::1',
      '::ffff:127.0.0.1',
      '::ffff:7f00:1',
      '64:ff9b::a00:1',
      'not an ip',
    ])
      expect(isPublicIp(ip), ip).toBe(false)
  })
})

describe('guardedFetch', () => {
  it('refuses to connect when the name resolves to an internal address', async () => {
    // localhost resolves to 127.0.0.1 / ::1 without the network: the knock never connects.
    await expect(
      guardedFetch('https://localhost:9/', {
        signal: AbortSignal.timeout(2_000),
        headers: {},
      }),
    ).rejects.toMatchObject({ code: 'EPRIVATE' })
  })
})

describe('probe', () => {
  type Answer = { status: number; location?: string } | Error
  /** A fetch that answers from a script, and remembers what it was asked. */
  const scripted = (answers: Record<string, Answer>) => {
    const asked: { url: string; init: RequestInit }[] = []
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      asked.push({ url, init: init ?? {} })
      const answer = answers[url]
      if (!answer) throw new TypeError('fetch failed')
      if (answer instanceof Error) throw answer
      const headers = answer.location ? { location: answer.location } : undefined
      const body = answer.status === 204 || answer.status === 304 ? null : 'the page'
      return new Response(body, { status: answer.status, headers })
    }) as typeof fetch
    return { fetchImpl, asked }
  }

  it('counts any answer below 500 as answering, and reads no further', async () => {
    for (const status of [200, 204, 403, 404, 429]) {
      const { fetchImpl, asked } = scripted({ 'https://a.example': { status } })
      expect(await probe('https://a.example', { fetchImpl })).toMatchObject({
        answered: true,
        code: status,
      })
      expect(asked[0].init.signal).toBeInstanceOf(AbortSignal)
      expect(new Headers(asked[0].init.headers).get('user-agent')).toMatch(/^FromnowhereStatus\//)
    }
  })

  it('counts a 5xx, a failed connection or a timeout as not answering', async () => {
    const { fetchImpl } = scripted({
      'https://a.example': { status: 503 },
      'https://b.example': new TypeError('fetch failed'),
    })
    expect(await probe('https://a.example', { fetchImpl })).toMatchObject({
      answered: false,
      code: 503,
    })
    expect(await probe('https://b.example', { fetchImpl })).toMatchObject({
      answered: false,
      code: null,
    })
    const hang = (async (_: unknown, init?: RequestInit) =>
      new Promise((_, reject) =>
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)),
      )) as typeof fetch
    const result = await probe('https://slow.example', { fetchImpl: hang, timeoutMs: 50 })
    expect(result).toMatchObject({ answered: false, code: null })
    expect(result.ms).toBeGreaterThanOrEqual(40)
  })

  it('follows redirects by hand, each one checked, and gives up after five', async () => {
    const { fetchImpl, asked } = scripted({
      'https://gati.hr/': { status: 301, location: 'https://www.gati.hr/' },
      'https://www.gati.hr/': { status: 200 },
    })
    expect(await probe('https://gati.hr/', { fetchImpl })).toMatchObject({
      answered: true,
      code: 200,
    })
    expect(asked.map((a) => a.url)).toEqual(['https://gati.hr/', 'https://www.gati.hr/'])

    const inside = scripted({
      'https://a.example/': { status: 302, location: 'https://127.0.0.1/admin' },
    })
    expect(await probe('https://a.example/', { fetchImpl: inside.fetchImpl })).toMatchObject({
      answered: false,
    })
    expect(inside.asked).toHaveLength(1)

    const loop = scripted(
      Object.fromEntries(
        Array.from({ length: 10 }, (_, k) => [
          `https://a.example/${k}`,
          { status: 302, location: `/${k + 1}` },
        ]),
      ),
    )
    expect(await probe('https://a.example/0', { fetchImpl: loop.fetchImpl })).toMatchObject({
      answered: false,
    })
    expect(loop.asked).toHaveLength(6)
  })

  it('never knocks on an address it may not', async () => {
    const { fetchImpl, asked } = scripted({})
    expect(await probe('https://localhost', { fetchImpl })).toMatchObject({ answered: false })
    expect(asked).toHaveLength(0)
  })
})
