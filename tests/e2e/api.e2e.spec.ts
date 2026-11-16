import { expect, test } from '@playwright/test'

const baseURL = 'http://localhost:3000'

test.describe('API surface', () => {
  test('there is no GraphQL endpoint', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/graphql`, {
      data: { query: '{ __schema { types { name } } }' },
    })
    expect(response.status()).toBe(404)
    expect(await response.text()).not.toContain('__schema')
  })

  test('there is no GraphQL playground', async ({ request }) => {
    expect((await request.get(`${baseURL}/api/graphql-playground`)).status()).toBe(404)
  })
})
