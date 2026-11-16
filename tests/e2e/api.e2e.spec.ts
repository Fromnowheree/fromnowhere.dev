import { expect, test } from '@playwright/test'

test.describe('API surface', () => {
  test('there is no GraphQL endpoint', async ({ request }) => {
    const response = await request.post('/api/graphql', {
      data: { query: '{ __schema { types { name } } }' },
    })
    expect(response.status()).toBe(404)
    expect(await response.text()).not.toContain('__schema')
  })

  test('there is no GraphQL playground', async ({ request }) => {
    expect((await request.get('/api/graphql-playground')).status()).toBe(404)
  })

  test('lists no uploads, drafts or status checks to a visitor', async ({ request }) => {
    // The files are public; the documents are not: a window attached to a draft project would
    // otherwise be listed here.
    for (const path of ['/api/media', '/api/status-checks', '/api/short-links', '/api/users'])
      expect((await request.get(path)).status(), path).toBe(403)
    const projects = await (await request.get('/api/projects?draft=true&limit=100')).json()
    for (const doc of projects.docs) expect(doc._status).toBe('published')
  })
})
