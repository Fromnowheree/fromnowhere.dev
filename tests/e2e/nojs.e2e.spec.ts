import { readFileSync } from 'node:fs'

import { expect, test, type Page } from '@playwright/test'

import { relayReady } from '../../src/lib/relay/config'

const baseURL = 'http://localhost:3000'

// The dev server reads the same .env as this test (playwright.config.ts loads it).
const formShown = relayReady(process.env)
const en = JSON.parse(readFileSync('messages/en.json', 'utf8'))

/**
 * The menu without JavaScript (src/components/NavLinks.tsx). The menu button is a script's
 * button, so without scripts a link to #site-nav takes its place and the drawer opens as the
 * address's target: every page in the menu stays reachable on a phone, not just the ones the
 * footer repeats. With scripts the link never shows, so the address never carries #site-nav.
 */
const SCREENS = [320, 390, 768]

for (const width of SCREENS) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } })

    test.describe('without JavaScript', () => {
      test.use({ javaScriptEnabled: false })

      test('the menu opens, shows every link and closes with Back', async ({ page }) => {
        await page.goto(`${baseURL}/en`)
        const drawer = page.locator('#site-nav')
        await expect(drawer).toBeHidden()
        // The menu's own links (the drawer's first list; the language switch has another).
        const links = page.locator('#site-nav > ul a[href]')
        expect(await links.count()).toBeGreaterThan(0)

        await page.locator('a[href="#site-nav"]').click()
        await expect(drawer).toBeVisible()
        for (const link of await links.all()) await expect(link).toBeVisible()

        await page.goBack()
        await expect(drawer).toBeHidden()
      })
    })

    test('with JavaScript the menu is the button, never the link', async ({ page }) => {
      await page.goto(`${baseURL}/en`)
      await expect(page.locator('[aria-controls="site-nav"]')).toBeVisible()
      await expect(page.locator('a[href="#site-nav"]')).toBeHidden()
    })
  })
}

test.describe('on a desktop without JavaScript', () => {
  test.use({ viewport: { width: 1280, height: 800 }, javaScriptEnabled: false })

  test('the menu is the row of links, with no menu link', async ({ page }) => {
    await page.goto(`${baseURL}/en`)
    await expect(page.locator('#site-nav')).toBeVisible()
    await expect(page.locator('a[href="#site-nav"]')).toBeHidden()
  })
})

/**
 * The contact form without JavaScript (src/components/blocks/ContactBlock.tsx): its proof of work
 * runs in the browser, so the server would refuse whatever was typed. The visitor is told so, with
 * the clinic's phone and e-mail, instead of being shown a form that cannot send. Only where the
 * form exists at all, i.e. with the CONTACT_* mail account set up.
 */
test.describe('the contact form', () => {
  test.skip(!formShown, 'the dev server has no CONTACT_* mail account, so it shows no form')
  const note = (page: Page) => page.locator('#form').getByText(en.form.needsScript)

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false })

    test('is replaced by how to reach the clinic', async ({ page }) => {
      await page.goto(`${baseURL}/en/contact`)
      await expect(note(page)).toBeVisible()
      await expect(note(page)).toContainText('@')
      await expect(page.locator('#form form')).toBeHidden()
    })
  })

  test('with JavaScript is the form, with no note', async ({ page }) => {
    await page.goto(`${baseURL}/en/contact`)
    await expect(page.locator('#form form')).toBeVisible()
    await expect(note(page)).toBeHidden()
  })
})
