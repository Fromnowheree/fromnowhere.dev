import { mkdirSync } from 'node:fs'
import path from 'node:path'

import { test, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config.js'
import { attachFixtureWindow } from '../helpers/fixtureWindow'

/**
 * Screenshots for looking at by eye (docs/phase-1.md, section 7, "Screenshots by eye"). Nothing
 * here compares pixels: a person checks the route map, the rail, the window and both themes.
 *
 * Writes to `test-results/phase1/`, or to VISUAL_DIR when it is set. Giogio's window is the test
 * fixture, attached through the Local API, so this runs in throwaway mode (E2E_PORT) only.
 */

test.skip(!process.env.E2E_PORT, 'Attaches a test picture: throwaway mode (E2E_PORT) only.')
test.describe.configure({ mode: 'serial' })

const outDir = path.resolve(process.env.VISUAL_DIR || 'test-results/phase1')

const pages = [
  { path: '/en', name: 'en' },
  { path: '/hr', name: 'hr' },
  { path: '/en/projects/giogio', name: 'en-giogio' },
  { path: '/en/projects/nmt', name: 'en-nmt' },
  { path: '/en/about', name: 'en-about' },
]
const widths = [375, 768, 1280]

let detach: (() => Promise<void>) | undefined

test.beforeAll(async () => {
  mkdirSync(outDir, { recursive: true })
  detach = await attachFixtureWindow(await getPayload({ config }))
})

test.afterAll(async () => {
  await detach?.()
})

/**
 * Opens the page, scrolls through it so every reveal below the fold has played (`<Motion>` holds
 * them back until they are seen), then returns to the top and lets the entrances settle.
 */
async function open(page: Page, address: string, width: number) {
  await page.setViewportSize({ width, height: 900 })
  await page.goto(address)
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 2) {
      scrollTo(0, y)
      await new Promise((resolve) => setTimeout(resolve, 60))
    }
    scrollTo(0, 0)
  })
  await page.waitForTimeout(400)
}

async function shoot(page: Page, name: string, animations: 'disabled' | 'allow' = 'disabled') {
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true, animations })
}

for (const colorScheme of ['dark', 'light'] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme })

    for (const { path: address, name } of pages) {
      test(`${name} at ${widths.join(', ')}`, async ({ page }) => {
        for (const width of widths) {
          await open(page, address, width)
          await shoot(page, `${name}-${width}-${colorScheme}`)
        }
      })
    }
  })
}

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  // Animations allowed: under reduced motion the first paint must already be the finished page.
  test('the home page and a project page, as first painted', async ({ page }) => {
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      for (const { path: address, name } of pages.slice(0, 3)) {
        await page.goto(address)
        await page.evaluate(() => document.fonts.ready)
        await shoot(page, `reduced-${name}-${width}`, 'allow')
      }
    }
  })
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('every page, at a phone and a desktop width', async ({ page }) => {
    for (const width of [375, 1280]) {
      for (const { path: address, name } of pages) {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(address)
        // Without JavaScript the CSS draw plays on every load. A full-page capture lays the page
        // out again and restarts it, so the wide map came out with no lines: grow the viewport
        // to the whole page first, let the draw finish, then take a plain capture.
        const height = await page.evaluate(() => document.documentElement.scrollHeight)
        await page.setViewportSize({ width, height })
        await page.waitForTimeout(2500)
        await page.screenshot({ path: path.join(outDir, `nojs-${name}-${width}.png`) })
      }
    }
  })

  test('hovering a plate still lights its line', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/en')
    // Without JavaScript the CSS draw plays on every load: let it finish before hovering.
    await page.waitForTimeout(2500)
    await page.locator('.map-plate').nth(1).hover()
    await page.locator('.map').screenshot({ path: path.join(outDir, 'nojs-en-1280-hover-02.png') })
  })
})
