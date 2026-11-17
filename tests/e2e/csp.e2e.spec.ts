import { expect, test, type Page } from '@playwright/test'

import { removeProbeSvg, seedProbeSvg } from '../helpers/seedMedia'

/**
 * The Content-Security-Policy every response carries (next.config.ts), checked by what the
 * browser does with it: another site cannot frame a page while the site itself can (the editor's
 * live preview), an injected <base> does not move the page's links, an injected form does not
 * post anywhere else, and the site's own pages break none of it.
 *
 * The other site that frames is the same server under another name, a different origin: Chrome
 * keeps a public site (as `elsewhere.test` would be) from framing localhost whatever the policy
 * says, so that would pass without one. `http://elsewhere.test` is answered by the test, never by
 * the network.
 */
const ELSEWHERE = 'http://elsewhere.test'

/** The server under another name: the same port on 127.0.0.1 instead of localhost. */
const otherOrigin = (baseURL: string) => {
  const url = new URL(baseURL)
  url.hostname = '127.0.0.1'
  return url.origin
}

/** Frames one of the site's pages in the current page: whether the frame shows it. */
const framesSite = async (page: Page, baseURL: string) => {
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

/**
 * Opens a 404 and waits until React has rendered it. A 404 arrives as Next's error shell
 * (`<html id="__next_error__">`, no `<main>`) and the client renders it from scratch, which empties
 * `<body>`: a frame appended before that would be removed with it and never load.
 */
const openMissingPage = async (page: Page, address: string) => {
  await page.goto(address)
  await page.locator('main').waitFor({ state: 'attached' })
}

test('another site cannot frame a page; the site itself can', async ({ page, baseURL }) => {
  const site = baseURL!
  await openMissingPage(page, `${otherOrigin(site)}/en/no-such-page`)
  expect(await framesSite(page, site)).toBe(false)

  // The editor frames the site for its live preview. A site page frames nothing at all
  // (`frame-src 'none'`, src/lib/csp.ts), so the editor's own page does the framing here.
  await page.goto('/admin/login')
  await page.locator('form').first().waitFor()
  expect(await framesSite(page, site)).toBe(true)
})

test('an injected <base> leaves the links on the site', async ({ page, baseURL }) => {
  await page.goto('/en')
  const baseURI = await page.evaluate((elsewhere) => {
    const base = document.createElement('base')
    base.href = `${elsewhere}/`
    document.head.prepend(base)
    return document.baseURI
  }, ELSEWHERE)
  expect(baseURI.startsWith(baseURL!)).toBe(true)
})

test('an injected form cannot post to another site', async ({ page, baseURL }) => {
  let posted = false
  await page.route(`${ELSEWHERE}/collect`, (route) => {
    posted = true
    return route.fulfill({ body: 'got it' })
  })
  await page.goto('/en')
  await page.evaluate((elsewhere) => {
    const form = document.createElement('form')
    form.method = 'post'
    form.action = `${elsewhere}/collect`
    document.body.append(form)
    form.submit()
  }, ELSEWHERE)
  await page.waitForTimeout(1000)
  expect(posted).toBe(false)
  expect(page.url().startsWith(baseURL!)).toBe(true)
})

test('every page carries a script policy with a nonce of its own', async ({ request }) => {
  const policyOf = async (path: string) =>
    (await request.get(path)).headers()['content-security-policy'] ?? ''
  const first = await policyOf('/en')
  const second = await policyOf('/en')
  const nonce = (policy: string) => /'nonce-([^']+)'/.exec(policy)?.[1]
  expect(first).toContain("'strict-dynamic'")
  expect(first).not.toMatch(/script-src[^;]*'unsafe-inline'/)
  expect(first).not.toContain("'unsafe-eval'")
  expect(nonce(first)).toBeTruthy()
  expect(nonce(second)).not.toBe(nonce(first))
  for (const path of ['/en/notes', '/hr/projects/giogio', '/en/no-such-page'])
    expect(await policyOf(path), path).toMatch(/script-src [^;]*'nonce-/)
})

test('the page’s own scripts run; injected ones do not', async ({ page }) => {
  // Stored XSS, simulated: the page's HTML arrives with markup that carries no nonce, under the
  // policy the server sent with it.
  await page.route('**/en', async (route) => {
    const response = await route.fetch()
    const html = (await response.text()).replace(
      '</body>',
      '<script>window.injected = (window.injected || []).concat("script")</script>' +
        '<img src="/no-such.png" onerror="window.injected = (window.injected || []).concat(\'handler\')">' +
        '<a id="js-link" href="javascript:window.injected = (window.injected || []).concat(\'link\')">x</a>' +
        '</body>',
    )
    await route.fulfill({ response, body: html })
  })
  await page.goto('/en')
  // React is running: the map's island marked it live.
  await expect(page.locator('#route-map')).toHaveClass(/is-live/)
  await page.locator('#js-link').click()
  await page.waitForTimeout(500)
  expect(await page.evaluate(() => (window as Window & { injected?: string[] }).injected)).toBe(
    undefined,
  )
})

test('the editor carries the policy too', async ({ request }) => {
  const response = await request.get('/admin')
  expect(response.headers()['content-security-policy']).toContain("frame-ancestors 'self'")
})

/**
 * The site's own pages within the policy: the home page (the route map, the board), a project
 * page and the other language. A violation is reported to the page as an event, collected from
 * before the first script runs.
 */
test.describe('the pages keep to the policy', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as Window & { violations?: string[] }
      w.violations = []
      document.addEventListener(
        'securitypolicyviolation',
        (event) => w.violations!.push(`${event.effectiveDirective} ${event.blockedURI}`),
        true,
      )
    })
  })

  for (const path of [
    '/en',
    '/en/projects/giogio',
    '/hr',
    '/en/notes',
    '/en/notes/notes-are-open',
    '/en/contact',
  ]) {
    test(`${path} fires no securitypolicyviolation`, async ({ page }) => {
      const response = await page.goto(path)
      expect(response?.status()).toBe(200)
      await page.waitForLoadState('networkidle')
      const violations = await page.evaluate(
        () => (window as Window & { violations?: string[] }).violations,
      )
      expect(violations).toEqual([])
    })
  }
})

test.describe('an uploaded SVG', () => {
  let address: string

  test.beforeAll(async () => {
    address = await seedProbeSvg()
  })

  test.afterAll(async () => {
    await removeProbeSvg()
  })

  test('opened by its address runs no script', async ({ page }) => {
    const response = await page.goto(address)
    expect(response?.headers()['content-type']).toContain('image/svg+xml')
    expect(response?.headers()['content-security-policy']).toContain("script-src 'none'")
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
})
