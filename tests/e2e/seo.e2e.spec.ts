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

test.describe('the notes feed', () => {
  test('is Atom, the newest first, in each language', async ({ request, baseURL }) => {
    const response = await request.get('/en/notes/feed.xml')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/atom+xml')
    const xml = await response.text()
    expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">')
    expect(xml).toContain(
      `<link rel="self" type="application/atom+xml" href="${baseURL}/en/notes/feed.xml"/>`,
    )
    const titles = [...xml.matchAll(/<entry>\s*<id>[^<]*<\/id>\s*<title>([^<]*)<\/title>/g)].map(
      (m) => m[1],
    )
    expect(titles[0]).toBe('Notes are open')
    expect(await (await request.get('/hr/notes/feed.xml')).text()).toContain('Bilješke su otvorene')
    expect((await request.get('/de/notes/feed.xml')).status()).toBe(404)
  })

  test('is named by the notes page and linked under its log', async ({ page }) => {
    await page.goto('/en/notes')
    await expect(
      page.locator('link[rel="alternate"][type="application/atom+xml"]'),
    ).toHaveAttribute('href', /\/en\/notes\/feed\.xml$/)
    await expect(page.locator('.notes-feed a')).toHaveAttribute('href', '/en/notes/feed.xml')
  })
})

test('every page describes itself to search engines (JSON-LD)', async ({ page }) => {
  const ld = async (path: string) => {
    await page.goto(path)
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
    expect(blocks, path).toHaveLength(1)
    return JSON.parse(blocks[0]!)
  }
  const home = await ld('/en')
  expect(home['@graph'].map((node: { '@type': string }) => node['@type'])).toEqual([
    'Organization',
    'WebSite',
  ])
  expect((await ld('/en/projects/giogio'))['@type']).toBe('CreativeWork')
  const note = await ld('/hr/notes/notes-are-open')
  expect(note['@type']).toBe('BlogPosting')
  expect(note.inLanguage).toBe('hr')
})

test('a phone can keep the site on its home screen', async ({ page, request }) => {
  await page.goto('/en')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  )
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1)
  const manifest = await (await request.get('/manifest.webmanifest')).json()
  for (const icon of manifest.icons)
    expect((await request.get(icon.src)).headers()['content-type'], icon.src).toBe('image/png')
})

test('security.txt says where to report a problem', async ({ request }) => {
  const response = await request.get('/.well-known/security.txt')
  expect(response.status()).toBe(200)
  expect(await response.text()).toMatch(/^Contact: mailto:/m)
})
