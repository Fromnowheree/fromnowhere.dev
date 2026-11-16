import { REST_POST } from '@payloadcms/next/routes'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

/**
 * The editor's sign-in and password reset are limited per address (src/lib/authLimits.ts,
 * src/collections/Users.ts), through Payload's own REST route as a browser would call it. The
 * limiters live in memory for the whole process, so every test uses addresses of its own.
 */

let payload: Payload
const editor = { email: 'auth-limits-editor@example.com', password: 'a-long-test-password-1234' }

beforeAll(async () => {
  payload = await getPayload({ config })
  await payload.delete({ collection: 'users', where: { email: { equals: editor.email } } })
  await payload.create({ collection: 'users', data: editor })
}, 120_000)

afterAll(async () => {
  await payload.delete({ collection: 'users', where: { email: { equals: editor.email } } })
})

/** POSTs to /api/users/<rest> from `address` (as Caddy reports it, the last X-Forwarded-For). */
const post = (rest: string, body: unknown, address: string) =>
  REST_POST(config)(
    new Request(`http://localhost:3000/api/users/${rest}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': `203.0.113.250, ${address}`,
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: ['users', rest] }) },
  )

const wrongLogin = (address: string) =>
  post('login', { email: 'nobody-here@example.com', password: 'wrong-password-1234' }, address)

describe('signing in', () => {
  it('stops one address after a burst of tries, before Payload sees the next one', async () => {
    for (let i = 0; i < 10; i++) expect((await wrongLogin('198.51.100.10')).status).not.toBe(429)
    const limited = await wrongLogin('198.51.100.10')
    expect(limited.status).toBe(429)
    expect(JSON.stringify(await limited.json())).toMatch(/Too many attempts/)
  })

  it('leaves every other address alone, and the editor can still sign in', async () => {
    for (let i = 0; i < 11; i++) await wrongLogin('198.51.100.20')
    const response = await post('login', editor, '198.51.100.21')
    expect(response.status).toBe(200)
  })
})

describe('"forgot password"', () => {
  it('sends at most a few reset mails per address, then refuses', async () => {
    const statuses = []
    for (let i = 0; i < 4; i++) {
      statuses.push(
        (await post('forgot-password', { email: editor.email }, '198.51.100.40')).status,
      )
    }
    expect(statuses.slice(0, 3).every((status) => status !== 429)).toBe(true)
    expect(statuses[3]).toBe(429)
    // Another address is not affected.
    expect(
      (await post('forgot-password', { email: editor.email }, '198.51.100.41')).status,
    ).not.toBe(429)
  })
})
