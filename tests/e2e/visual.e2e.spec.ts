import { mkdirSync } from 'node:fs'
import path from 'node:path'

import { test, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config.js'
import { attachFixtureWindow } from '../helpers/fixtureWindow'

/**
 * Screenshots of Night transit for looking at by eye, beside docs/prototypes/night-transit.html at
 * the same widths. Nothing here compares pixels: a person checks the sky, the map and its opening,
 * the board, the project pages' trips and exits, and the phone layouts.
 *
 * Writes to `test-results/night/`, or to VISUAL_DIR when it is set. Giogio's window is the test
 * fixture, attached through the Local API, so this runs in throwaway mode (E2E_PORT) only.
 */

test.skip(!process.env.E2E_PORT, 'Attaches a test picture: throwaway mode (E2E_PORT) only.')
test.describe.configure({ mode: 'serial' })

const outDir = path.resolve(process.env.VISUAL_DIR || 'test-results/night')

const pages = [
  { path: '/en', name: 'en' },
  { path: '/hr', name: 'hr' },
  { path: '/en/projects/giogio', name: 'en-giogio' },
  { path: '/en/projects/nmt', name: 'en-nmt' },
  { path: '/en/projects/gati', name: 'en-gati' },
  { path: '/en/services', name: 'en-services' },
  { path: '/hr/services', name: 'hr-services' },
  { path: '/en/capabilities', name: 'en-capabilities' },
  { path: '/en/contact', name: 'en-contact' },
  { path: '/en/about', name: 'en-about' },
  { path: '/en/no-such-page', name: 'en-404' },
]
const widths = [1440, 375]
// VISUAL_ONLY=en-services,en names the pages to capture, when only some changed.
const only = process.env.VISUAL_ONLY?.split(',')

let detach: (() => Promise<void>) | undefined

test.beforeAll(async () => {
  mkdirSync(outDir, { recursive: true })
  detach = await attachFixtureWindow(await getPayload({ config }))
})

test.afterAll(async () => {
  await detach?.()
})

/**
 * Opens the page, waits out the opening, scrolls through so the board's rows have arrived, then
 * returns to the top. Trains and loops keep running, so a capture is one moment of them.
 */
async function open(page: Page, address: string, width: number) {
  await page.setViewportSize({ width, height: 900 })
  await page.goto(address)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(3_000)
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 2) {
      scrollTo(0, y)
      await new Promise((resolve) => setTimeout(resolve, 120))
    }
    scrollTo(0, 0)
  })
  await page.waitForTimeout(1_500)
}

const shoot = (page: Page, name: string, fullPage = true) =>
  page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage })

for (const { path: address, name } of pages.filter(({ name }) => !only || only.includes(name))) {
  test(`${name} at ${widths.join(' and ')}`, async ({ page }) => {
    for (const width of widths) {
      await open(page, address, width)
      await shoot(page, `${name}-${width}`)
    }
  })
}

test('the home page’s opening, mid-way and as it settles', async ({ page }) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/en')
    await page.evaluate(() => document.fonts.ready)
    await page.reload({ waitUntil: 'commit' })
    const start = Date.now()
    for (const at of [600, 1200, 2000]) {
      await page.waitForTimeout(Math.max(0, at - (Date.now() - start)))
      await shoot(page, `en-${width}-intro-${at}ms`, false)
    }
  }
})

test('lit: a terminal pointed at, and a board row', async ({ page }) => {
  await open(page, '/en', 1440)
  await page.locator('.term[data-line="giogio"] .term__name').hover()
  await page.waitForTimeout(700)
  await shoot(page, 'en-1440-lit-terminal', false)
  await page.locator('.row[data-line="nmt"]').hover()
  await page.waitForTimeout(700)
  await page.locator('#departures').screenshot({ path: path.join(outDir, 'en-1440-lit-row.png') })
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('the home page as first painted: whole, and still', async ({ page }) => {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/en')
      await page.evaluate(() => document.fonts.ready)
      await shoot(page, `reduced-en-${width}`)
    }
  })
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('the home page and a project page', async ({ page }) => {
    for (const width of widths) {
      for (const address of ['/en', '/en/projects/nmt']) {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(address)
        // The opening is CSS and plays without a script too: let it finish first.
        await page.waitForTimeout(3_500)
        await shoot(page, `nojs${address.replace(/\//g, '-')}-${width}`)
      }
    }
  })
})
