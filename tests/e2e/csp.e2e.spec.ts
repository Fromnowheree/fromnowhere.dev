import { expect, test, type Page } from '@playwright/test'

const baseURL = 'http://localhost:3000'

/**
 * The Content-Security-Policy every response carries (next.config.ts), checked by what the
 * browser does with it: another site cannot frame a page while the site itself can (the editor's
 * live preview), an injected <base> does not move the page's links, and an injected form does not
 * post anywhere else.
 *
 * The other site that frames is the same server under another name, a different origin: Chrome
 * keeps a public site (as `elsewhere.test` would be) from framing localhost whatever the policy
 * says, so that would pass without one. `http://elsewhere.test` is answered by the test, never by
 * the network.
 */
const OTHER_ORIGIN = 'http://127.0.0.1:3000'
const ELSEWHERE = 'http://elsewhere.test'

/** Frames one of the site's pages in the current page: whether the frame shows it. */
const framesSite = async (page: Page) => {
  await page.evaluate(
    (src) =>
      new Promise((done) => {
        const frame = document.createElement('iframe')
        // Fires for the page and for the browser's refusal alike.
        frame.onload = done
        frame.src = src
        document.body.append(frame)
      }),
    `${baseURL}/en`,
  )
  return page
    .frames()
    .slice(1)
    .some((frame) => frame.url().startsWith(baseURL))
}

test('another site cannot frame a page; the site itself can', async ({ page }) => {
  await page.goto(`${OTHER_ORIGIN}/en/no-such-page`)
  expect(await framesSite(page)).toBe(false)

  await page.goto(`${baseURL}/en/no-such-page`)
  expect(await framesSite(page)).toBe(true)
})

test('an injected <base> leaves the links on the site', async ({ page }) => {
  await page.goto(`${baseURL}/en`)
  const baseURI = await page.evaluate((elsewhere) => {
    const base = document.createElement('base')
    base.href = `${elsewhere}/`
    document.head.prepend(base)
    return document.baseURI
  }, ELSEWHERE)
  expect(baseURI.startsWith(baseURL)).toBe(true)
})

test('an injected form cannot post to another site', async ({ page }) => {
  let posted = false
  await page.route(`${ELSEWHERE}/collect`, (route) => {
    posted = true
    return route.fulfill({ body: 'got it' })
  })
  await page.goto(`${baseURL}/en`)
  await page.evaluate((elsewhere) => {
    const form = document.createElement('form')
    form.method = 'post'
    form.action = `${elsewhere}/collect`
    document.body.append(form)
    form.submit()
  }, ELSEWHERE)
  await page.waitForTimeout(1000)
  expect(posted).toBe(false)
  expect(page.url().startsWith(baseURL)).toBe(true)
})

test('the editor carries the policy too', async ({ request }) => {
  const response = await request.get(`${baseURL}/admin`)
  expect(response.headers()['content-security-policy']).toContain("frame-ancestors 'self'")
})

test('an uploaded SVG opened by its address runs no script', async ({ page }) => {
  // The demo clinic's logo (src/seed/), an SVG from the media collection.
  const response = await page.goto(`${baseURL}/api/media/file/demo-logo.svg`)
  expect(response?.headers()['content-type']).toContain('image/svg+xml')
  // A script the document would run if anything slipped into it, added as the SVG's own element.
  const ran = await page.evaluate(async () => {
    const w = window as Window & { ran?: boolean }
    const script = document.createElementNS('http://www.w3.org/2000/svg', 'script')
    script.textContent = 'window.ran = true'
    document.documentElement.append(script)
    await new Promise((done) => setTimeout(done, 200))
    return w.ran === true
  })
  expect(ran).toBe(false)
})
