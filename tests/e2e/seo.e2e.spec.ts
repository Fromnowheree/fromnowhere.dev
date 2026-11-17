import { expect, test } from '@playwright/test'

/**
 * What the site tells machines: /llms.txt (src/app/llms.txt/route.ts) for language models, beside
 * robots.txt and the sitemap. Published content only, from the seed.
 */
test.describe('/llms.txt', () => {
  test('is Markdown with the studio, its projects, pages and notes', async ({
    request,
    baseURL,
  }) => {
    const response = await request.get('/llms.txt')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/markdown')
    const text = await response.text()
    expect(text.startsWith('# Fromnowhere\n\n> ')).toBe(true)
    for (const heading of ['## Projects', '## Pages', '## Notes', '## Optional'])
      expect(text).toContain(`\n${heading}\n`)
    expect(text).toContain(`- [Giogio](${baseURL}/en/projects/giogio): Line 02`)
    expect(text).toContain('https://giogio.music')
    expect(text).toContain(`- [About](${baseURL}/en/about)`)
    expect(text).toContain(`(${baseURL}/en/contact)`)
    expect(text).toContain(`- [Notes are open](${baseURL}/en/notes/notes-are-open) (2026-11-17)`)
    expect(text).toContain(`${baseURL}/sitemap.xml`)
    // The status as the editor set it: no live word like Delayed.
    expect(text).not.toContain('delayed')
  })

  test('is answered at the root, not sent off to a language', async ({ request }) => {
    const response = await request.get('/llms.txt', { maxRedirects: 0 })
    expect(response.status()).toBe(200)
  })
})

test('robots.txt keeps the editor and the API out, and names the sitemap', async ({ request }) => {
  const text = await (await request.get('/robots.txt')).text()
  expect(text).toContain('Disallow: /admin')
  expect(text).toContain('Disallow: /api')
  expect(text).toMatch(/Sitemap: .*\/sitemap\.xml/)
})
