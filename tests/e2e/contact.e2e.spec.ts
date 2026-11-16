import { expect, test } from '@playwright/test'

import { relayReady } from '../../src/lib/relay/config'

const baseURL = 'http://localhost:3000'

// The dev server reads the same .env as this test (playwright.config.ts loads it), so the test
// knows whether the form's mail account is set up and checks the matching behaviour.
const configured = relayReady(process.env)

test.describe('the contact form', () => {
  test("its challenge route is this site's, not swallowed by Payload's /api routes", async ({
    request,
  }) => {
    const response = await request.get(`${baseURL}/api/contact/challenge`)
    expect(response.headers()['cache-control']).toContain('no-store')
    if (configured) {
      expect(response.status()).toBe(200)
      const challenge = await response.json()
      expect(challenge.parameters?.algorithm).toBe('PBKDF2/SHA-256')
      expect(challenge.signature).toBeTruthy()
    } else {
      expect(response.status()).toBe(503)
      expect((await response.json()).error).toBeTruthy()
    }
  })

  test('the map tells Google nothing about the page it is on', async ({ page }) => {
    // Google is never actually contacted from the test.
    await page.route(/maps\.google\.com/, (route) => route.abort())
    await page.goto(`${baseURL}/en/contact?service=example-service`)
    await expect(page.locator('iframe')).toHaveCount(0)
    await page.getByRole('button', { name: 'Show the map' }).click()
    await expect(page.locator('iframe')).toHaveAttribute('referrerpolicy', 'no-referrer')
  })

  for (const locale of ['en', 'hr']) {
    test(`is offered only while it can send (${locale})`, async ({ request }) => {
      const html = await (await request.get(`${baseURL}/${locale}/contact`)).text()
      const hasForm = /<input[^>]*name="formStarted"/.test(html)
      expect(hasForm).toBe(configured)
      // Without the relay the visitor is pointed at the phone straight away.
      if (!configured) expect(html).toContain('+1 555 0100')
    })
  }

  test("the site's own enquiry buttons promise the form only while it is there", async ({
    page,
  }) => {
    // A phone: the quick-contact bar and the service page's card are both on screen.
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${baseURL}/en/services/physiotherapy`)
    const bar = page.getByRole('navigation', { name: 'Quick contact' })
    const aside = page.locator('aside')
    if (configured) {
      await expect(bar.getByRole('link', { name: 'Enquire' })).toHaveAttribute(
        'href',
        '/en/contact#form',
      )
      await expect(aside.getByRole('link', { name: 'Send an enquiry' })).toHaveAttribute(
        'href',
        '/en/contact?service=physiotherapy#form',
      )
    } else {
      await expect(bar.getByRole('link', { name: 'Contact', exact: true })).toHaveAttribute(
        'href',
        '/en/contact',
      )
      await expect(aside.getByRole('link', { name: 'Contact us' })).toHaveAttribute(
        'href',
        '/en/contact',
      )
      await expect(page.getByRole('link', { name: /enquir/i })).toHaveCount(0)
    }
  })

  test('a band that asks the visitor to call shows the number, on a desktop too', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`${baseURL}/en`)
    const band = page.locator('section', {
      has: page.getByRole('heading', { name: 'Questions? Call us.' }),
    })
    const call = band.getByRole('link', { name: '+1 555 0100' })
    await expect(call).toBeVisible()
    await expect(call).toHaveAttribute('href', /^tel:/)
  })
})
