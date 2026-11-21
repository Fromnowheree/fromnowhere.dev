import { GRAPHQL_POST, REST_GET, REST_POST } from '@payloadcms/next/routes'
import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

let payload: Payload

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

describe('the Local API', () => {
  it('starts against the database and answers a query', async () => {
    const users = await payload.find({ collection: 'users', limit: 1 })
    expect(users.docs).toBeInstanceOf(Array)
  })
})

describe('GraphQL', () => {
  const introspection = () =>
    new Request('http://localhost:3000/api/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ __schema { types { name } } }' }),
    })

  // Payload's own GraphQL handler, which a route file at api/graphql would export. It must
  // refuse even if such a file came back, so the switch in the config is what decides.
  it("Payload's GraphQL handler answers no query", async () => {
    const response = await GRAPHQL_POST(config)(introspection())
    expect(response.status).toBe(404)
    expect(await response.text()).not.toContain('__schema')
  })

  // With no route files at api/graphql or api/graphql-playground, Next hands both paths to the
  // REST catch-all (src/app/(payload)/api/[...slug]/route.ts), which must answer neither.
  // The playground has no file because Payload's playground handler renders the page outside
  // production even with GraphQL switched off.
  it('the REST catch-all answers no query at /api/graphql', async () => {
    const response = await REST_POST(config)(introspection(), {
      params: Promise.resolve({ slug: ['graphql'] }),
    })
    expect(response.status).toBe(404)
    expect(await response.text()).not.toContain('__schema')
  })

  it('the REST catch-all serves no playground at /api/graphql-playground', async () => {
    const response = await REST_GET(config)(
      new Request('http://localhost:3000/api/graphql-playground'),
      { params: Promise.resolve({ slug: ['graphql-playground'] }) },
    )
    expect(response.status).toBe(404)
  })
})

describe('an uploaded file that is not there', () => {
  const file = (name: string) =>
    REST_GET(config)(new Request(`http://localhost:3000/api/media/file/${name}`), {
      params: Promise.resolve({ slug: ['media', 'file', name] }),
    })

  // Payload's own answer is 500 with an error in the log, on an address anyone can ask for.
  it('answers 404, not a server error', async () => {
    const response = await file('no-such-picture.webp')
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('Not found')
  })

  it('leaves a name that would leave the uploads folder to Payload, which refuses it', async () => {
    const { isMissingUpload } = await import('@/collections/Media')
    expect(isMissingUpload('no-such-picture.webp', '/tmp')).toBe(true)
    expect(isMissingUpload('../etc/passwd', '/tmp')).toBe(false)
    expect(isMissingUpload('../no-such-file', '/tmp')).toBe(false)
    expect((await file('..%2F..%2Fpackage.json')).status).not.toBe(200)
  })
})

describe('the health check', () => {
  // compose.yml's container health check, which Caddy waits for before it starts.
  it('answers 200 once Payload is up and the database answers', async () => {
    const { GET } = await import('@/app/(frontend)/api/healthz/route')
    const response = await GET()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})
