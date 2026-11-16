import { REST_POST } from '@payloadcms/next/routes'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { siteOrigins } from '@/lib/siteOrigins'
import config from '@/payload.config'

/**
 * The editor's session cookie works only for requests from the site itself. Other subdomains of
 * the site's domain (yugioh.<domain> and the other sites served next to this one; stats.<domain>,
 * the statistics dashboard) are the same SITE, so the browser still sends a SameSite=Lax cookie
 * with a form they post here. Such a request must be treated as anonymous, or a page there could
 * create an admin while an editor is signed in.
 */

let payload: Payload
const run = `${process.pid}-${Date.now()}`
const editor = { email: `csrf-editor-${run}@example.com`, password: 'csrf-editor-password-1234' }
let token = ''

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await payload.create({ collection: 'users', data: editor })
  token = (await payload.login({ collection: 'users', data: editor })).token ?? ''
  expect(token).not.toBe('')
}, 120_000)

afterAll(async () => {
  await payload.delete({
    collection: 'users',
    where: { email: { like: `-${run}@example.com` } },
  })
})

const exists = async (email: string) =>
  (await payload.count({ collection: 'users', where: { email: { equals: email } } })).totalDocs > 0

/**
 * What a page on another origin can send without a preflight: a plain multipart form, with the
 * document in Payload's `_payload` field, and the browser adding the editor's cookie.
 */
const createUserAs = (email: string, headers: Record<string, string>) => {
  const form = new FormData()
  form.set('_payload', JSON.stringify({ email, password: 'chosen-by-the-other-page-1' }))
  return REST_POST(config)(
    new Request('http://localhost:3000/api/users', {
      method: 'POST',
      headers: { cookie: `payload-token=${token}`, ...headers },
      body: form,
    }),
    { params: Promise.resolve({ slug: ['users'] }) },
  )
}

describe('a signed-in editor’s cookie', () => {
  it('creates nothing when the form was posted from another subdomain', async () => {
    const email = `csrf-from-subdomain-${run}@example.com`
    const response = await createUserAs(email, { origin: 'https://yugioh.example.com' })
    expect(response.ok).toBe(false)
    expect(await exists(email)).toBe(false)
  })

  it('creates nothing from a cross-site request that names no origin', async () => {
    const email = `csrf-no-origin-${run}@example.com`
    const response = await createUserAs(email, { 'sec-fetch-site': 'cross-site' })
    expect(response.ok).toBe(false)
    expect(await exists(email)).toBe(false)
  })

  it('still works from the site itself', async () => {
    const email = `csrf-from-site-${run}@example.com`
    const response = await createUserAs(email, { origin: siteOrigins()[0]! })
    expect(response.status).toBe(201)
    expect(await exists(email)).toBe(true)
  })
})

describe('the allowed origins', () => {
  it('are only the site’s own address in production', async () => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SITE_URL', 'https://example.com/')
    try {
      const { siteOrigins: fresh } = await import('@/lib/siteOrigins')
      expect(fresh()).toEqual(['https://example.com'])
    } finally {
      vi.unstubAllEnvs()
      vi.resetModules()
    }
  })
})
