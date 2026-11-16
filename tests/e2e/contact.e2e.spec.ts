import { readFileSync } from 'node:fs'

import { expect, test } from '@playwright/test'

import { readRelayConfig } from '../../src/lib/relay/config'

const en = JSON.parse(readFileSync('messages/en.json', 'utf8'))

/**
 * Whether the server's relay is ready (relayReady): its CONTACT_* mail account is set up. The
 * server reads the same .env as this test (playwright.config.ts loads it, and throwaway mode
 * passes it on), and always has a PAYLOAD_SECRET to sign with (the dev server cannot start
 * without one; throwaway mode supplies one), so the account decides.
 */
const configured = readRelayConfig(process.env) !== null

test.describe('the contact form', () => {
  test("its challenge route is this site's, not swallowed by Payload's /api routes", async ({
    request,
  }) => {
    const response = await request.get('/api/contact/challenge')
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

  for (const locale of ['en', 'hr']) {
    test(`is offered only while it can send (${locale})`, async ({ request }) => {
      const html = await (await request.get(`/${locale}/contact`)).text()
      const hasForm = /<input[^>]*name="formStarted"/.test(html)
      expect(hasForm).toBe(configured)
    })
  }

  test('without the relay the contact page has no form, and says so', async ({ page }) => {
    test.skip(configured, 'the server has the CONTACT_* mail account, so it shows the form')
    await page.goto('/en/contact')
    await expect(page.locator('form')).toHaveCount(0)
    await expect(page.getByText(en.contact.noForm)).toBeVisible()
  })

  test("the home page's band leads to the contact page", async ({ page }) => {
    await page.goto('/en')
    const action = page.locator('.home-band').getByRole('link', { name: en.home.contactAction })
    await expect(action).toBeVisible()
    await expect(action).toHaveAttribute('href', '/en/contact')
  })
})
