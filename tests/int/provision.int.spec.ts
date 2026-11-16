import { REST_POST } from '@payloadcms/next/routes'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { PROVISION_HEADER, provisionToken } from '@/lib/provision'
import { useFreshDatabase } from '../helpers/freshDatabase'

/**
 * The first admin is created at provisioning, never by whoever opens /admin first
 * (src/lib/provision.ts, src/collections/Users.ts, scripts/create-admin.mjs). These run against
 * a database of their own, because the property is about an install with NO users at all.
 *
 * They run as production does (NODE_ENV=production), since provisioning only ever happens there:
 * the schema comes from the migrations, not from a development push, and the session cookie is
 * the one the live site sets.
 */

let payload: Payload
let config: Awaited<typeof import('@/payload.config')>['default']
let drop: (payload?: Payload) => Promise<void>

beforeAll(async () => {
  ;({ drop } = await useFreshDatabase('provision'))
  process.env.PAYLOAD_SEED = 'false'
  // Before the config is imported: the collections read it when they load.
  vi.stubEnv('NODE_ENV', 'production')
  config = (await import('@/payload.config')).default
  const { getPayload } = await import('payload')
  payload = await getPayload({ config })
}, 120_000)

afterAll(async () => {
  await drop?.(payload)
  vi.unstubAllEnvs()
}, 60_000)

const url = (rest: string) => `http://localhost:3000/api/users/${rest}`

/** POSTs to /api/users/<rest> through Payload's own REST route, as a visitor's browser would. */
const post = (rest: string, body: unknown, headers: Record<string, string> = {}) =>
  REST_POST(config)(
    new Request(url(rest), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: ['users', ...rest.split('/')] }) },
  )

const admin = { email: 'first-admin@example.com', password: 'a-long-test-password-1234' }

/** The session cookie a response sets, or undefined. */
const sessionCookie = (response: Response) =>
  response.headers.getSetCookie().find((c) => c.startsWith('payload-token='))
const userCount = async () => (await payload.count({ collection: 'users' })).totalDocs

describe('the first admin', () => {
  it('cannot be claimed by a visitor on an install with no users', async () => {
    expect(await userCount()).toBe(0)
    const response = await post('first-register', admin)
    expect(response.status).toBe(403)
    expect(await userCount()).toBe(0)
  })

  it('cannot be claimed with a token made from another secret', async () => {
    const response = await post('first-register', admin, {
      [PROVISION_HEADER]: provisionToken('some-other-secret')!,
    })
    expect(response.status).toBe(403)
    expect(await userCount()).toBe(0)
  })

  it('cannot be created over REST by anyone signed out', async () => {
    const response = await post('', admin)
    expect([401, 403]).toContain(response.status)
    expect(await userCount()).toBe(0)
  })

  it('is created by provisioning: create-admin.mjs derives the same token as the app', async () => {
    const script = await import('../../scripts/create-admin.mjs')
    const secret = process.env.PAYLOAD_SECRET!
    expect(script.PROVISION_HEADER).toBe(PROVISION_HEADER)
    expect(script.provisionToken(secret)).toBe(provisionToken(secret))

    const response = await post('first-register', admin, {
      [script.PROVISION_HEADER]: script.provisionToken(secret),
    })
    expect(response.status).toBe(200)
    expect(await userCount()).toBe(1)

    // Its session cookie is host-only, so the other sites on subdomains never receive it.
    const cookies = response.headers.getSetCookie()
    expect(cookies.some((c) => c.startsWith('payload-token='))).toBe(true)
    for (const cookie of cookies) expect(cookie).not.toMatch(/;\s*domain=/i)
  })

  it('is created only once: provisioning again is refused', async () => {
    const response = await post(
      'first-register',
      { email: 'second@example.com', password: 'another-long-password-5678' },
      { [PROVISION_HEADER]: provisionToken(process.env.PAYLOAD_SECRET)! },
    )
    expect(response.status).toBe(403)
    expect(await userCount()).toBe(1)
  })

  it('signs in with a host-only session cookie', async () => {
    const response = await post('login', admin)
    expect(response.status).toBe(200)
    const cookies = response.headers.getSetCookie()
    expect(cookies.length).toBeGreaterThan(0)
    for (const cookie of cookies) expect(cookie).not.toMatch(/;\s*domain=/i)
  })

  it('signs in with a cookie that travels only over HTTPS and stays off other sites’ requests', async () => {
    const cookie = sessionCookie(await post('login', admin))
    expect(cookie).toBeDefined()
    expect(cookie).toMatch(/;\s*Secure(=true)?(;|$)/i)
    expect(cookie).toMatch(/;\s*SameSite=Lax(;|$)/i)
    expect(cookie).toMatch(/;\s*HttpOnly(=true)?(;|$)/i)
  })

  it('leaves the Local API alone (seeds and tests still create users)', async () => {
    await payload.create({
      collection: 'users',
      data: { email: 'local@example.com', password: 'local-api-password-90' },
    })
    expect(await userCount()).toBe(2)
  })

  it('gets a long random password', async () => {
    const { generatePassword } = await import('../../scripts/create-admin.mjs')
    const a = generatePassword()
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(generatePassword()).not.toBe(a)
  })
})
