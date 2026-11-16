import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { useFreshDatabase } from '../helpers/freshDatabase'

/**
 * The site's database gets its schema from the migrations alone: production never pushes
 * (AGENTS.md, "Migrations"). Booted as production on an empty database of its own, Payload
 * applies every migration in src/migrations/index.ts, and the studio's settings and the content,
 * including the latest fields, can then be read and written.
 */

let payload: Payload
let drop: (payload?: Payload) => Promise<void>
let migrations: { name: string }[]

beforeAll(async () => {
  ;({ drop } = await useFreshDatabase('migrations'))
  process.env.PAYLOAD_SEED = 'false'
  vi.stubEnv('NODE_ENV', 'production')
  const config = (await import('@/payload.config')).default
  ;({ migrations } = await import('@/migrations'))
  const { getPayload } = await import('payload')
  payload = await getPayload({ config })
}, 120_000)

afterAll(async () => {
  await drop?.(payload)
  vi.unstubAllEnvs()
}, 60_000)

describe('a database built by the migrations', () => {
  it('has run every one of them, in order', async () => {
    const { docs } = await payload.find({
      collection: 'payload-migrations',
      sort: 'createdAt',
      limit: 100,
    })
    expect(docs.map((doc) => doc.name)).toEqual(migrations.map((m) => m.name))
  })

  it('holds the studio’s settings, with statistics off until they are switched on', async () => {
    const studio = await payload.findGlobal({ slug: 'studio', depth: 0 })
    expect(studio.visitorStatistics).toBe(false)
    const saved = await payload.updateGlobal({
      slug: 'studio',
      locale: 'hr',
      data: {
        headline: 'Svaki projekt kreće iz iste točke',
        email: 'studio@example.com',
        profiles: [{ label: 'GitHub', url: 'https://github.com/example' }],
        visitorStatistics: true,
      },
    })
    expect(saved.email).toBe('studio@example.com')
    expect(saved.visitorStatistics).toBe(true)
  })

  it('holds a project, its addresses and its short link', async () => {
    const project = await payload.create({
      collection: 'projects',
      data: {
        _status: 'published',
        name: 'Migrated',
        summary: 'A project in a migrated database.',
        line: 1,
        status: 'running',
        kind: 'product',
        addresses: [{ url: 'https://example.com' }],
      },
    })
    expect(project.slug).toBe('migrated')
    const link = await payload.create({
      collection: 'short-links',
      data: { alias: 'migrated', project: project.id },
    })
    expect(link.alias).toBe('migrated')
  })
})
