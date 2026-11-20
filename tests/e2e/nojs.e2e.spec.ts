import { readFileSync } from 'node:fs'

import { expect, test, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import { readRelayConfig } from '../../src/lib/relay/config'
import config from '../../src/payload.config.js'

const en = JSON.parse(readFileSync('messages/en.json', 'utf8'))
const hr = JSON.parse(readFileSync('messages/hr.json', 'utf8'))

/** Whether the server shows the form at all (see contact.e2e.spec.ts): its CONTACT_* account. */
const formShown = readRelayConfig(process.env) !== null

/** The address the contact test shows when the studio has none of its own (a reserved domain). */
const PROBE_EMAIL = 'e2e-probe@example.com'

/** Pages a visitor reaches first: the home page (map and board), a project page, the contact
 * page, and what the studio offers (in Croatian too: its words are longer). */
const PAGES = [
  '/en',
  '/en/projects/giogio',
  '/en/contact',
  '/en/services',
  '/hr/services',
  '/en/capabilities',
  '/hr/capabilities',
]

/** A phone, a large phone and a tablet. */
const SCREENS = [320, 390, 768]

/**
 * The site without JavaScript: every page is server-rendered HTML with plain links, so it reads
 * and navigates the same. The header has no menu button to depend on a script; its links stay on
 * screen at every width, and nothing pushes the page sideways.
 */
for (const width of SCREENS) {
  test.describe(`without JavaScript at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 }, javaScriptEnabled: false })

    for (const path of PAGES) {
      test(`${path} renders, with the header's links and no sideways scroll`, async ({ page }) => {
        const response = await page.goto(path)
        expect(response?.status()).toBe(200)
        await expect(page.locator('#content h1')).toBeVisible()

        const header = page.locator('header.site-nav')
        const nav = (path.startsWith('/hr') ? hr : en).nav
        // A phone keeps one link beside the action: Services (the logo leads to the work).
        await expect(
          header
            .getByRole('navigation', { name: nav.main })
            .getByRole('link', { name: width <= 440 ? nav.services : nav.projects }),
        ).toBeVisible()
        await expect(header.getByRole('link', { name: nav.contact })).toBeVisible()
        // The language switch: EN and HR, each the same page in its language.
        await expect(header.locator('a[hreflang="en"]')).toBeVisible()
        await expect(header.locator('a[hreflang="hr"]')).toBeVisible()

        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }))
        expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
      })
    }
  })
}

/**
 * The contact form without JavaScript (src/app/(frontend)/[locale]/(site)/contact/page.tsx): its
 * proof of work runs in the browser, so the server would refuse whatever was typed. The visitor is
 * told so instead of being shown a form that cannot send, with the address to write to below it.
 * Only where the form exists at all, i.e. with the CONTACT_* mail account set up.
 */
test.describe('the contact form', () => {
  test.skip(!formShown, 'the server has no CONTACT_* mail account, so it shows no form')
  // By its element, not getByText: Playwright's text matching skips what is inside <noscript>,
  // which is where the note lives.
  const note = (page: Page) => page.locator('noscript > p.contact__note')

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false })

    /**
     * The address shows only while the studio has one (Studio global, `email`), and the seed sets
     * none. The test brings its own through the Local API (same DATABASE_URL as the server, see
     * playwright.config.ts) and puts back whatever was there; an address already set is used as is.
     */
    let address = PROBE_EMAIL
    let restore: (() => Promise<void>) | null = null

    test.beforeAll(async () => {
      const payload = await getPayload({ config })
      const studio = await payload.findGlobal({ slug: 'studio', depth: 0 })
      if (studio.email) {
        address = studio.email
        return
      }
      await payload.updateGlobal({ slug: 'studio', data: { email: PROBE_EMAIL } })
      restore = async () => {
        await payload.updateGlobal({ slug: 'studio', data: { email: null } })
      }
    })

    test.afterAll(async () => {
      await restore?.()
    })

    test('is replaced by how to reach me', async ({ page }) => {
      await page.goto('/en/contact')
      await expect(note(page)).toBeVisible()
      await expect(note(page)).toHaveText(en.form.needsScript)
      await expect(page.locator('.contact-form')).toBeHidden()
      // The address to write to instead.
      const mail = page.locator('.contact__direct a[href^="mailto:"]')
      await expect(mail).toHaveCount(1)
      await expect(mail).toBeVisible()
      await expect(mail).toHaveAttribute('href', `mailto:${address}`)
    })
  })

  test('with JavaScript is the form, with no note', async ({ page }) => {
    await page.goto('/en/contact')
    await expect(page.locator('.contact-form')).toBeVisible()
    await expect(note(page)).toBeHidden()
  })
})
