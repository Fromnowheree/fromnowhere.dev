import { getPayload } from 'payload'

import config from '../../src/payload.config.js'

/** The probe's file name in the media collection. */
export const PROBE_SVG = 'e2e-probe.svg'

/** A plain SVG with no active content (Payload refuses an upload with scripts in it). */
const PROBE_MARKUP =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">' +
  '<rect width="16" height="16" fill="#75798c"/></svg>'

/** Removes the probe (every media document stored under its name), its file included. */
export async function removeProbeSvg(): Promise<void> {
  const payload = await getPayload({ config })
  await payload.delete({
    collection: 'media',
    where: { filename: { equals: PROBE_SVG } },
  })
}

/**
 * Uploads an SVG to the media collection through the Local API, for the tests that check how the
 * site serves an upload (its own Content-Security-Policy). The seed uploads no SVG, so the test
 * brings its own and removes it afterwards with `removeProbeSvg()`.
 *
 * Runs in the test process against the same DATABASE_URL and MEDIA_DIR as the server
 * (playwright.config.ts): the development database by default, the throwaway one with E2E_PORT.
 *
 * Returns the upload's address on the site, relative to `baseURL`.
 */
export async function seedProbeSvg(): Promise<string> {
  // A probe left behind by an interrupted run would make Payload rename this one.
  await removeProbeSvg()
  const payload = await getPayload({ config })
  const data = Buffer.from(PROBE_MARKUP)
  const doc = await payload.create({
    collection: 'media',
    locale: 'en',
    data: { alt: 'Test picture: a grey square.' },
    file: { data, mimetype: 'image/svg+xml', name: PROBE_SVG, size: data.length },
  })
  return `/api/media/file/${encodeURIComponent(doc.filename ?? PROBE_SVG)}`
}
