import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { getLocalI18n, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { useFreshDatabase } from '../helpers/freshDatabase'
import { FIXTURE_ADDRESS, FIXTURE_FILE, makeFixtureWebp } from '../helpers/fixtureWindow'
import type { WindowSeed } from '@/seed/windowSeeds'

/**
 * Windows (docs/phase-1.md, "Windows"): the seed attaches one only from a committed capture
 * listed in src/seed/windowSeeds.ts, which is empty in Phase 1; a window names one of its
 * project's own addresses. On a database of its own, because the seed runs only on an empty one,
 * and with uploads in a temporary directory, never the development media folder.
 */

let payload: Payload
let drop: (payload?: Payload) => Promise<void>
let seed: typeof import('@/seed').seed
let WINDOWS: WindowSeed[]
let mediaDir: string
let windowsDir: string
let emptyDir: string

const fixtureEntry: WindowSeed = {
  slug: 'giogio',
  file: FIXTURE_FILE,
  address: FIXTURE_ADDRESS,
  colorScheme: 'dark',
  alt: { en: 'Test picture: two blue bands.', hr: 'Testna slika: dvije plave trake.' },
  caption: { en: 'Test window.', hr: 'Testni prozor.' },
}

beforeAll(async () => {
  ;({ drop } = await useFreshDatabase('windows'))
  mediaDir = await mkdtemp(path.join(os.tmpdir(), 'fnw-windows-media-'))
  windowsDir = await mkdtemp(path.join(os.tmpdir(), 'fnw-windows-seed-'))
  emptyDir = await mkdtemp(path.join(os.tmpdir(), 'fnw-windows-empty-'))
  process.env.MEDIA_DIR = mediaDir
  process.env.PAYLOAD_SEED = 'false'
  await makeFixtureWebp(windowsDir)
  const config = (await import('@/payload.config')).default
  ;({ seed } = await import('@/seed'))
  ;({ WINDOWS } = await import('@/seed/windowSeeds'))
  const { getPayload } = await import('payload')
  payload = await getPayload({ config })
}, 120_000)

afterAll(async () => {
  await drop?.(payload)
  for (const dir of [mediaDir, windowsDir, emptyDir])
    if (dir) await rm(dir, { recursive: true, force: true })
}, 60_000)

/** Back to an empty site, so the next seed runs again. */
async function emptySite() {
  const all = { id: { exists: true } }
  for (const collection of ['notes', 'short-links', 'projects', 'pages', 'media'] as const)
    await payload.delete({ collection, where: all })
}

const projectsWithWindows = async () => {
  const { docs } = await payload.find({ collection: 'projects', depth: 0, limit: 100 })
  return docs.filter((doc) => doc.window != null).map((doc) => doc.slug)
}

const projectBySlug = async (slug: string, locale: 'en' | 'hr') => {
  const { docs } = await payload.find({
    collection: 'projects',
    where: { slug: { equals: slug } },
    locale,
    depth: 1,
    limit: 1,
  })
  return docs[0]!
}

describe('the seed', () => {
  it('lists no windows in Phase 1, and attaches none by default without an error', async () => {
    expect(WINDOWS).toEqual([])
    await emptySite()
    const error = vi.spyOn(payload.logger, 'error')
    const info = vi.spyOn(payload.logger, 'info')
    await seed(payload)
    expect(error).not.toHaveBeenCalled()
    expect(info.mock.calls.flat().join('\n')).not.toMatch(/no window for/)
    expect(info.mock.calls.flat().join('\n')).toMatch(/Seed: done\./)
    error.mockRestore()
    info.mockRestore()
    expect(await projectsWithWindows()).toEqual([])
  })

  it('attaches a listed window from its capture, in both languages', async () => {
    await emptySite()
    await seed(payload, { windowsDir, windows: [fixtureEntry] })
    expect(await projectsWithWindows()).toEqual(['giogio'])

    const en = await projectBySlug('giogio', 'en')
    const hr = await projectBySlug('giogio', 'hr')
    const enMedia = en.window as { alt: string; width?: number | null; height?: number | null }
    const hrMedia = hr.window as { alt: string }
    expect(enMedia.alt).toBe(fixtureEntry.alt.en)
    expect(hrMedia.alt).toBe(fixtureEntry.alt.hr)
    expect(enMedia.alt).not.toBe(hrMedia.alt)
    expect([enMedia.width, enMedia.height]).toEqual([780, 976])

    expect(en.windowAddress).toBe('https://presstart.giogio.music')
    expect(en.windowCaption).toBe(fixtureEntry.caption.en)
    expect(hr.windowCaption).toBe(fixtureEntry.caption.hr)
    expect(en.windowCaption).not.toBe(hr.windowCaption)

    expect((await projectBySlug('nmt', 'en')).window ?? null).toBeNull()
  })

  it('completes without a window when the listed capture is missing', async () => {
    await emptySite()
    const info = vi.spyOn(payload.logger, 'info')
    await seed(payload, { windowsDir: emptyDir, windows: [fixtureEntry] })
    expect(info.mock.calls.flat().join('\n')).toContain(
      `Seed: no window for giogio (${FIXTURE_FILE} not found).`,
    )
    expect(info.mock.calls.flat().join('\n')).toMatch(/Seed: done\./)
    info.mockRestore()
    expect(await projectsWithWindows()).toEqual([])
  })
})

describe('the window’s address', () => {
  it('is one of the project’s own addresses, or empty', async () => {
    const giogio = await projectBySlug('giogio', 'en')
    await expect(
      payload.update({
        collection: 'projects',
        id: giogio.id,
        data: { windowAddress: 'https://example.com' },
      }),
    ).rejects.toThrow(/windowAddress|The window shows/)

    const padded = await payload.update({
      collection: 'projects',
      id: giogio.id,
      data: { windowAddress: '  https://prod.giogio.music  ' },
    })
    expect(padded.windowAddress).toBe('https://prod.giogio.music')

    const cleared = await payload.update({
      collection: 'projects',
      id: giogio.id,
      data: { windowAddress: '' },
    })
    expect(cleared.windowAddress ?? '').toBe('')
  })

  it('says what is wrong in the editor’s language', async () => {
    const nmt = await projectBySlug('nmt', 'en')
    const refusal = async (language: 'en' | 'hr') => {
      // The admin passes the editor's interface language as req.i18n; the Local API defaults to
      // English, so the Croatian case builds the same i18n Payload would for a Croatian editor.
      const i18n = await getLocalI18n({ config: payload.config, language })
      const error = await payload
        .update({
          collection: 'projects',
          id: nmt.id,
          data: { windowAddress: 'https://nmt.example' },
          req: { i18n },
        })
        .catch((e: unknown) => e)
      return JSON.stringify((error as { data?: unknown }).data)
    }
    const en = await refusal('en')
    const hr = await refusal('hr')
    expect(en).toContain('Use one of this project’s addresses, or leave it empty.')
    expect(hr).toContain('Upišite jednu od adresa ovog projekta ili ostavite prazno.')
    expect(hr).not.toContain('Use one of this project’s addresses')
  })
})

describe('committed captures (src/seed/windows)', () => {
  it('are each 780×976 and at most 150 KB', async () => {
    const dir = path.resolve('src/seed/windows')
    const files = (await readdir(dir)).filter((name) => name.endsWith('.webp'))
    for (const name of files) {
      const file = path.join(dir, name)
      const { width, height } = await sharp(file).metadata()
      expect([name, width, height]).toEqual([name, 780, 976])
      expect((await stat(file)).size, name).toBeLessThanOrEqual(150 * 1024)
    }
  })
})
