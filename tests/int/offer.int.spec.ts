import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CAPABILITY_AREAS } from '@/collections/Capabilities'
import { linkTarget, RESERVED_PAGE_SLUGS, resolveLink } from '@/lib/links'
import {
  getCapabilities,
  getPublishedIndex,
  getPublishedSummaries,
  getServices,
} from '@/lib/payload'
import { isShortAlias } from '@/lib/shortLinks'
import config from '@/payload.config'
import { seed } from '@/seed'
import { CAPABILITIES, SERVICES, seedOffer } from '@/seed/offer'

/**
 * What the studio offers: the services (lettered in their order, each with the published
 * projects behind it) and the capabilities (by area, each with where it is in service). Like the
 * notes, nothing about either is public until one is published.
 */

let payload: Payload
let draftProject: number

const clear = async () => {
  await payload.delete({ collection: 'services', where: { id: { exists: true } } })
  await payload.delete({ collection: 'capabilities', where: { id: { exists: true } } })
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await seed(payload)
  await clear()
  await payload.delete({ collection: 'projects', where: { slug: { equals: 'offer-draft' } } })
  draftProject = (
    await payload.create({
      collection: 'projects',
      draft: true,
      data: { name: 'Offer draft', slug: 'offer-draft', line: 97, summary: 'Hidden.' },
    })
  ).id
}, 120_000)

afterAll(async () => {
  await clear()
  await payload.delete({ collection: 'projects', id: draftProject })
  // Leave the database as the seed would: other files read the seeded services.
  await seedOffer(payload)
})

describe('the addresses', () => {
  it('belong to the site: no page and no short link may take them', () => {
    for (const word of ['services', 'capabilities']) {
      expect(RESERVED_PAGE_SLUGS).toContain(word)
      expect(isShortAlias(word)).toBe(false)
    }
    expect(linkTarget('/services')).toEqual({ kind: 'services' })
    expect(linkTarget('/services#websites')).toEqual({ kind: 'services' })
    expect(linkTarget('/capabilities')).toEqual({ kind: 'capabilities' })
  })
})

describe('while nothing is published', () => {
  it('there are no services, no capabilities, and no link to either page', async () => {
    await payload.create({
      collection: 'services',
      draft: true,
      data: { name: 'A draft', summary: 'Not yet.', order: 1, slug: 'offer-draft-service' },
    })
    expect(await getServices('en')).toEqual([])
    expect(await getCapabilities('en')).toEqual([])
    const index = await getPublishedIndex()
    expect(index.services).toBe(false)
    expect(index.capabilities).toBe(false)
    expect(resolveLink('/services', index)).toBeNull()
    expect(resolveLink('/capabilities', index)).toBeNull()
    const summaries = await getPublishedSummaries()
    expect(summaries.services).toBeNull()
    expect(summaries.capabilities).toBeNull()
    await clear()
  })
})

describe('the seed', () => {
  it('says each thing in both languages (its voice is tests/int/voice.int.spec.ts)', () => {
    for (const { en, hr } of [...SERVICES, ...CAPABILITIES])
      expect(Object.values(hr).flat().join(' ')).not.toBe(Object.values(en).flat().join(' '))
    expect(new Set(CAPABILITIES.map((c) => c.area))).toEqual(new Set(CAPABILITY_AREAS))
  })

  it('writes both where there are none, once', async () => {
    await seedOffer(payload)
    await seedOffer(payload)
    expect((await payload.count({ collection: 'services' })).totalDocs).toBe(SERVICES.length)
    expect((await payload.count({ collection: 'capabilities' })).totalDocs).toBe(
      CAPABILITIES.length,
    )
  })
})

describe('the published services', () => {
  it('are lettered in their order, with the lines behind them in line order', async () => {
    const services = await getServices('en')
    expect(services.map((s) => `${s.letter} ${s.slug}`)).toEqual(
      SERVICES.map((s, i) => `${String.fromCharCode(65 + i)} ${s.slug}`),
    )
    const websites = services.find((s) => s.slug === 'websites')!
    expect(websites.proof.map((p) => p.slug)).toEqual(['giogio', 'gati'])
    expect((await getServices('hr'))[0]!.name).toBe(SERVICES[0]!.hr.name)
    expect((await getPublishedIndex()).services).toBe(true)
  })

  it('leave a draft project out of their proof, and a draft service out altogether', async () => {
    const { docs } = await payload.find({
      collection: 'services',
      where: { slug: { equals: 'products' } },
      limit: 1,
      depth: 0,
    })
    const products = docs[0]!
    await payload.update({
      collection: 'services',
      id: products.id,
      data: { projects: [...((products.projects as number[]) ?? []), draftProject] },
    })
    const listed = (await getServices('en')).find((s) => s.slug === 'products')!
    expect(listed.proof.map((p) => p.slug)).toEqual(['nmt'])

    await payload.update({ collection: 'services', id: products.id, data: { _status: 'draft' } })
    const after = await getServices('en')
    expect(after.map((s) => s.slug)).not.toContain('products')
    // The letters close up: the third service is C no longer.
    expect(after.map((s) => s.letter)).toEqual(['A', 'B', 'C'])
  })
})

describe('the published capabilities', () => {
  it('come by area in the page’s order, each with where it is in service', async () => {
    const groups = await getCapabilities('en')
    expect(groups.map((g) => g.area)).toEqual([...CAPABILITY_AREAS])
    expect(groups.flatMap((g) => g.items)).toHaveLength(CAPABILITIES.length)
    for (const group of groups)
      expect(group.items.map((item) => item.title)).toEqual(
        CAPABILITIES.filter((c) => c.area === group.area).map((c) => c.en.title),
      )
    const first = groups[0]!.items[0]!
    expect(first.onThisSite).toBe(true)
    expect(first.proof.map((p) => p.slug)).toEqual(['locals'])
    expect((await getPublishedIndex()).capabilities).toBe(true)
  })
})
