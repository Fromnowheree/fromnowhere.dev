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

  test('reads nothing to a visitor: the site reads through the Local API', async ({ request }) => {
    // The files are public; the documents are not: a window attached to a draft project would
    // otherwise be listed here, and a draft's text through ?draft=true.
    for (const path of [
      '/api/media',
      '/api/status-checks',
      '/api/short-links',
      '/api/users',
      '/api/projects',
      '/api/projects?draft=true&limit=100',
      '/api/projects/versions',
      '/api/pages',
      '/api/pages/versions',
      '/api/notes',
      '/api/notes/versions',
      '/api/globals/studio',
      '/api/globals/studio/versions',
      '/api/payload-jobs',
    ])
      expect((await request.get(path)).status(), path).toBe(403)
  })

  test('writes nothing for a visitor', async ({ request }) => {
    for (const collection of ['projects', 'pages', 'notes', 'short-links', 'media'])
      expect(
        (await request.post(`/api/${collection}`, { data: { title: 'x' } })).status(),
        collection,
      ).toBe(403)
  })

  test('every response carries the basic headers, and none names the framework', async ({
    request,
  }) => {
    for (const path of ['/en', '/admin', '/api/users', '/llms.txt', '/og/en']) {
      const headers = (await request.get(path)).headers()
      expect(headers['x-content-type-options'], path).toBe('nosniff')
      expect(headers['referrer-policy'], path).toBe('strict-origin-when-cross-origin')
      expect(headers['permissions-policy'], path).toContain('camera=()')
      expect(headers['cross-origin-opener-policy'], path).toBe('same-origin')
      expect(headers['x-powered-by'], path).toBeUndefined()
    }
  })
})
