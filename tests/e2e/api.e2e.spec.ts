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
})
