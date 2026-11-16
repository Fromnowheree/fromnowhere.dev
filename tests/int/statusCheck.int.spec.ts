import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runStatusCheck } from '@/jobs/checkStatus'
import type { ProbeResult } from '@/lib/probe'
import config from '@/payload.config'
import { seed } from '@/seed'

/**
 * The status check's round against a real database, with the network replaced by a script: what
 * it knocks on, what it writes, how it counts misses, and what it clears away. Also that only the
 * job writes the rows: an editor (or anyone through the API) can at most read them.
 */

let payload: Payload
const DRAFT = 'sc-draft-project'

const rows = async () =>
  (await payload.find({ collection: 'status-checks', limit: 100, pagination: false, sort: 'url' }))
    .docs

const cleanUp = async () => {
  await payload.delete({ collection: 'status-checks', where: { id: { exists: true } } })
  await payload.delete({ collection: 'projects', where: { slug: { equals: DRAFT } } })
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await seed(payload)
  await cleanUp()
})

afterAll(cleanUp)

/** A probe that answers from a set of addresses that are down, and remembers what it was asked. */
const network = (down: Set<string>) => {
  const asked: string[] = []
  const probeImpl = async (url: string): Promise<ProbeResult> => {
    asked.push(url)
    return down.has(url)
      ? { answered: false, code: 503, ms: 40 }
      : { answered: true, code: 200, ms: 120 }
  }
  return { probeImpl, asked }
}

const at = (iso: string) => () => new Date(iso)

describe('runStatusCheck', () => {
  it('knocks once on every address of every published project, never a draft’s', async () => {
    await payload.create({
      collection: 'projects',
      draft: true,
      data: {
        name: 'Draft line',
        slug: DRAFT,
        line: 77,
        summary: 'x',
        status: 'running',
        kind: 'product',
        addresses: [{ url: 'https://draft-only.example' }],
        _status: 'draft',
      },
    })
    const { probeImpl, asked } = network(new Set())
    const summary = await runStatusCheck(payload, { probeImpl, now: at('2026-11-16T12:00:00Z') })

    expect(asked.sort()).toEqual([
      'https://giogio.music',
      'https://presstart.giogio.music',
      'https://prod.giogio.music',
      'https://www.gati.hr',
      'https://yugioh.fromnowhere.dev',
    ])
    expect(summary).toEqual({ checked: 5, answered: 5, removed: 0 })
    expect((await rows()).map((row) => [row.url, row.answered, row.code, row.failures])).toEqual(
      asked.map((url) => [url, true, 200, 0]),
    )
  })

  it('counts misses in a row, and starts again at the first answer', async () => {
    const down = new Set(['https://www.gati.hr'])
    await runStatusCheck(payload, {
      probeImpl: network(down).probeImpl,
      now: at('2026-11-16T12:05:00Z'),
    })
    await runStatusCheck(payload, {
      probeImpl: network(down).probeImpl,
      now: at('2026-11-16T12:10:00Z'),
    })
    let gati = (await rows()).find((row) => row.url === 'https://www.gati.hr')!
    expect(gati).toMatchObject({ answered: false, code: 503, failures: 2 })
    expect(new Date(gati.checkedAt).toISOString()).toBe('2026-11-16T12:10:00.000Z')
    // The last answer is kept while it is down.
    expect(new Date(gati.answeredAt!).toISOString()).toBe('2026-11-16T12:00:00.000Z')

    await runStatusCheck(payload, {
      probeImpl: network(new Set()).probeImpl,
      now: at('2026-11-16T12:15:00Z'),
    })
    gati = (await rows()).find((row) => row.url === 'https://www.gati.hr')!
    expect(gati).toMatchObject({ answered: true, failures: 0 })
    expect(new Date(gati.answeredAt!).toISOString()).toBe('2026-11-16T12:15:00.000Z')
  })

  it('clears the rows of addresses no published project has any more', async () => {
    await payload.create({
      collection: 'status-checks',
      overrideAccess: true,
      data: {
        url: 'https://gone.example',
        answered: true,
        failures: 0,
        checkedAt: '2026-11-16T12:00:00Z',
      },
    })
    const summary = await runStatusCheck(payload, {
      probeImpl: network(new Set()).probeImpl,
      now: at('2026-11-16T12:20:00Z'),
    })
    expect(summary.removed).toBe(1)
    expect((await rows()).map((row) => row.url)).not.toContain('https://gone.example')
  })
})

describe('the status-checks collection', () => {
  it('is written by the check alone: nobody may create, change or delete a row', async () => {
    const [row] = await rows()
    const user = { id: 1, collection: 'users', email: 'editor@example.com' } as never
    await expect(
      payload.create({
        collection: 'status-checks',
        overrideAccess: false,
        user,
        data: { url: 'https://x.example', failures: 0, checkedAt: '2026-11-16T12:00:00Z' },
      }),
    ).rejects.toThrow()
    await expect(
      payload.update({
        collection: 'status-checks',
        id: row.id,
        overrideAccess: false,
        user,
        data: { failures: 9 },
      }),
    ).rejects.toThrow()
    await expect(
      payload.delete({ collection: 'status-checks', id: row.id, overrideAccess: false, user }),
    ).rejects.toThrow()
  })

  it('is read by a signed-in editor only', async () => {
    await expect(
      payload.find({ collection: 'status-checks', overrideAccess: false }),
    ).rejects.toThrow()
    const user = { id: 1, collection: 'users', email: 'editor@example.com' } as never
    const { totalDocs } = await payload.find({
      collection: 'status-checks',
      overrideAccess: false,
      user,
    })
    expect(totalDocs).toBeGreaterThan(0)
  })
})
