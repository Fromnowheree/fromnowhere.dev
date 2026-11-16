import { expect, test } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import { attachFixtureWindow, FIXTURE_ALT, FIXTURE_CAPTION } from '../helpers/fixtureWindow'

/**
 * A window on a project page (docs/phase-1.md, "Windows"). Phase 1 seeds none, so the test
 * attaches the fixture picture through the Local API, in the test process against the same
 * database and MEDIA_DIR as the server: throwaway mode only (E2E_PORT), never the development
 * database.
 */

test.skip(!process.env.E2E_PORT, 'Attaches a test picture: throwaway mode (E2E_PORT) only.')
test.describe.configure({ mode: 'serial' })

let payload: Payload
let detach: (() => Promise<void>) | undefined

test.beforeAll(async () => {
  payload = await getPayload({ config })
  detach = await attachFixtureWindow(payload)
})

test.afterAll(async () => {
  await detach?.()
})

test.describe('a project’s window', () => {
  test('sits in the facts, before the exit plates, framed and unlinked', async ({ page }) => {
    await page.goto('/en/projects/giogio')
    const window = page.locator('.project__facts > figure.window')
    await expect(window).toHaveCount(1)

    // Look through the window, then go out the door.
    const order = await page.locator('.project__facts').evaluate((facts) => {
      const children = [...facts.children]
      return {
        window: children.findIndex((el) => el.matches('figure.window')),
        exits: children.findIndex((el) => el.matches('.project__exits')),
      }
    })
    expect(order.window).toBe(0)
    expect(order.window).toBeLessThan(order.exits)

    await expect(window.locator('img')).toHaveAttribute('alt', FIXTURE_ALT.en)
    await expect(window.locator('.window__addr')).toHaveText('presstart.giogio.music')
    await expect(window.locator('.window__bar')).toHaveAttribute('aria-hidden', 'true')
    await expect(window.locator('figcaption')).toHaveText(FIXTURE_CAPTION.en)
    await expect(window.locator('a')).toHaveCount(0)

    const box = await window.locator('.window__view').boundingBox()
    expect(box).not.toBeNull()
    expect(Math.abs(box!.width / box!.height - 0.8)).toBeLessThanOrEqual(0.008)
  })

  test('speaks the page’s language', async ({ page }) => {
    await page.goto('/hr/projects/giogio')
    const window = page.locator('figure.window')
    await expect(window.locator('img')).toHaveAttribute('alt', FIXTURE_ALT.hr)
    await expect(window.locator('figcaption')).toHaveText(FIXTURE_CAPTION.hr)
  })

  test('is shown only where a project has one', async ({ page }) => {
    await page.goto('/en/projects/nmt')
    await expect(page.locator('.window')).toHaveCount(0)
  })

  test('never makes the page scroll sideways at 320', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    await page.goto('/en/projects/giogio')
    await expect(page.locator('figure.window')).toHaveCount(1)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('is gone once the picture is detached', async ({ page }) => {
    await detach?.()
    detach = undefined
    await page.goto('/en/projects/giogio')
    await expect(page.locator('.window')).toHaveCount(0)
  })
})
