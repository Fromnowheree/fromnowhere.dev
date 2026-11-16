import { expect, test, type APIRequestContext } from '@playwright/test'

/** The seeded pages (src/seed/index.ts), by their address without a language (the same in every
 * language). */
const pages = ['', '/contact', '/about', '/privacy', '/projects/giogio', '/projects/nmt']

/** The page's HTML without its scripts: what a visitor and a search engine read. */
const visible = async (request: APIRequestContext, path: string) => {
  const response = await request.get(path, { maxRedirects: 0 })
  const html = await response.text()
  return { status: response.status(), html: html.replace(/<script[\s\S]*?<\/script>/g, '') }
}

test.describe('languages', () => {
  test('an address without a language goes to one the visitor reads', async ({ request }) => {
    const response = await request.get('/contact', {
      maxRedirects: 0,
      headers: { 'accept-language': 'hr-HR,hr;q=0.9,en;q=0.5' },
    })
    expect(response.status()).toBe(307)
    expect(response.headers()['location']).toBe('/hr/contact')
  })

  test('a page whose address starts like /og, /api or /admin still gets its language', async ({
    request,
  }) => {
    for (const path of ['/ogledi', '/administracija', '/apiterapija']) {
      const response = await request.get(path, {
        maxRedirects: 0,
        headers: { 'accept-language': 'hr' },
      })
      expect(response.status(), path).toBe(307)
      expect(response.headers()['location'], path).toBe(`/hr${path}`)
    }
  })

  test('every page, in both languages, says its language, links to the other and advertises it', async ({
    request,
  }) => {
    for (const locale of ['en', 'hr']) {
      const other = locale === 'en' ? 'hr' : 'en'
      for (const path of pages) {
        const { status, html } = await visible(request, `/${locale}${path}`)
        expect(status, `/${locale}${path}`).toBe(200)
        expect(html).toContain(`<html lang="${locale}"`)
        // The language switch: a link to the same page in the other language.
        expect(html, `/${locale}${path}`).toMatch(
          new RegExp(`hrefLang="${other}"[^>]*href="/${other}${path}"`),
        )
        // hreflang alternates for search engines.
        expect(html).toMatch(
          new RegExp(`<link rel="alternate" hrefLang="${other}" href="[^"]*/${other}${path}"`),
        )
        // A key missing from a message file renders as its raw path.
        expect(html, `/${locale}${path}`).not.toMatch(
          />\s*(common|nav|language|home|map|board|status|kind|project|footer|contact|form|mail|notFound)\.[a-zA-Z.]+\s*</,
        )
      }
    }
  })

  test('the two languages really are different text', async ({ request }) => {
    const en = await visible(request, '/en/contact')
    const hr = await visible(request, '/hr/contact')
    const heading = (html: string) => html.match(/<h1[^>]*>([^<]*)</)?.[1]
    expect(heading(en.html)).toBeTruthy()
    expect(heading(hr.html)).not.toBe(heading(en.html))
  })
})
