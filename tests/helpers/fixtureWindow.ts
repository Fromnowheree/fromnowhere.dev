import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { Payload } from 'payload'
import sharp from 'sharp'

/**
 * A test-only window (docs/phase-1.md, "Test fixture"): Phase 1 seeds no windows, so the tests
 * and screenshots that need one attach this picture in a throwaway database. It is never
 * committed under src/ and never shown as a real destination.
 */

export const FIXTURE_FILE = 'fixture-window.webp'
export const FIXTURE_ALT = {
  en: 'Test picture: two blue bands.',
  hr: 'Testna slika: dvije plave trake.',
}
export const FIXTURE_CAPTION = { en: 'Test window.', hr: 'Testni prozor.' }
export const FIXTURE_ADDRESS = 'https://presstart.giogio.music'

const WIDTH = 780
const HEIGHT = 976

/** Writes a 780×976 WebP into `dir`, two flat bands (#101830 over #3a6df0); returns its path. */
export async function makeFixtureWebp(dir: string): Promise<string> {
  const top = await sharp({
    create: { width: WIDTH, height: HEIGHT / 2, channels: 3, background: '#101830' },
  })
    .png()
    .toBuffer()
  const file = path.join(dir, FIXTURE_FILE)
  await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: '#3a6df0' } })
    .composite([{ input: top, top: 0, left: 0 }])
    .webp({ quality: 80 })
    .toFile(file)
  return file
}

/**
 * Uploads the fixture and gives the project (Giogio by default) its window: the picture, the
 * address it shows (presstart.giogio.music) and a caption, in English and Croatian. Returns
 * `detach()`, which clears the three fields and deletes the picture again.
 */
export async function attachFixtureWindow(
  payload: Payload,
  slug = 'giogio',
): Promise<() => Promise<void>> {
  const { docs } = await payload.find({
    collection: 'projects',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
  })
  const project = docs[0]
  if (!project) throw new Error(`attachFixtureWindow: no project "${slug}"`)

  const dir = await mkdtemp(path.join(os.tmpdir(), 'fnw-fixture-window-'))
  let mediaId: number
  try {
    const media = await payload.create({
      collection: 'media',
      locale: 'en',
      data: { alt: FIXTURE_ALT.en, focalX: 50, focalY: 0 },
      filePath: await makeFixtureWebp(dir),
    })
    mediaId = media.id
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
  await payload.update({
    collection: 'media',
    id: mediaId,
    locale: 'hr',
    data: { alt: FIXTURE_ALT.hr },
  })
  await payload.update({
    collection: 'projects',
    id: project.id,
    locale: 'en',
    data: { window: mediaId, windowAddress: FIXTURE_ADDRESS, windowCaption: FIXTURE_CAPTION.en },
  })
  await payload.update({
    collection: 'projects',
    id: project.id,
    locale: 'hr',
    data: { windowCaption: FIXTURE_CAPTION.hr },
  })

  return async () => {
    await payload.update({
      collection: 'projects',
      id: project.id,
      locale: 'en',
      data: { window: null, windowAddress: null, windowCaption: null },
    })
    await payload.update({
      collection: 'projects',
      id: project.id,
      locale: 'hr',
      data: { windowCaption: null },
    })
    await payload.delete({ collection: 'media', id: mediaId })
  }
}
