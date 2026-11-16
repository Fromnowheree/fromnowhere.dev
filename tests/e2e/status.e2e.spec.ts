import { expect, test } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'

/**
 * The live board (Phase 2): what the status check wrote decides what a visitor sees. The server
 * runs with STATUS_CHECKS=off (playwright.config.ts), so nothing on the network changes the
 * rows; the test writes them through the Local API, in the test process against the same
 * database as the server: throwaway mode only (E2E_PORT), never the development database.
 */

test.skip(!process.env.E2E_PORT, 'Writes status checks: throwaway mode (E2E_PORT) only.')
test.describe.configure({ mode: 'serial' })

let payload: Payload

const write = async (url: string, failures: number, minutesAgo = 1) => {
  const checkedAt = new Date(Date.now() - minutesAgo * 60_000).toISOString()
  const data = { url, failures, answered: failures === 0, checkedAt }
  const { docs } = await payload.find({
    collection: 'status-checks',
    where: { url: { equals: url } },
    limit: 1,
  })
  if (docs[0]) await payload.update({ collection: 'status-checks', id: docs[0].id, data })
  else await payload.create({ collection: 'status-checks', data })
}

const clear = () => payload.delete({ collection: 'status-checks', where: { id: { exists: true } } })

test.beforeAll(async () => {
  payload = await getPayload({ config })
  await clear()
})

test.afterAll(async () => {
  await clear()
})

test.describe('the live board', () => {
  test('a running line whose address stopped answering is Delayed, its trains held', async ({
    page,
  }) => {
    await write('https://www.gati.hr', 2)
    await write('https://presstart.giogio.music', 3)
    await page.goto('/en')

    const gati = page.locator('.board .row[data-line="gati"]')
    await expect(gati.locator('.status')).toHaveText('Delayed')
    await expect(gati.locator('.row__sub')).toHaveText('Not answering just now')

    // A further stop that is quiet is named; the line itself still runs.
    const giogio = page.locator('.board .row[data-line="giogio"]')
    await expect(giogio.locator('.status')).toHaveText('Running')
    await expect(giogio.locator('a.is-quiet')).toHaveText(/presstart\.giogio\.music\s*No answer/)

    await expect(page.locator('.tally')).toContainText('Delayed')
    await expect(page.locator('.term--delayed[data-line="gati"]')).toHaveCount(1)
    await expect(page.locator('.map__svg--wide .line--delayed[data-line="gati"]')).toHaveCount(1)
    await expect(page.locator('.map__svg--wide .line[data-line="gati"] .train')).toHaveCount(0)

    // A delayed line's longer card name never pushes the phone page sideways.
    await page.setViewportSize({ width: 320, height: 800 })
    await page.goto('/en')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320)
    await expect(page.getByRole('link', { name: 'Line 04, Gati, Delayed' })).toHaveCount(1)
    await page.setViewportSize({ width: 1280, height: 800 })

    await page.goto('/hr/projects/gati')
    await expect(page.locator('.project__status .status')).toHaveText('Kasni')
    await expect(page.locator('.exit--quiet .exit__quiet')).toHaveText('Trenutačno ne odgovara')
  })

  test('one missed answer is a blip, and a stale check says nothing', async ({ page }) => {
    await write('https://www.gati.hr', 1)
    await write('https://yugioh.fromnowhere.dev', 5, 45)
    await write('https://presstart.giogio.music', 0)
    await page.goto('/en')
    for (const slug of ['gati', 'locals', 'giogio'])
      await expect(page.locator(`.board .row[data-line="${slug}"] .status`)).toHaveText('Running')
    await expect(page.locator('.board .is-quiet')).toHaveCount(0)
    await expect(page.locator('.tally')).not.toContainText('Delayed')
  })
})

test.describe('share cards', () => {
  test('are drawn for published pages only, as images', async ({ request }) => {
    for (const path of ['/og/en', '/og/en/projects/giogio', '/og/hr/projects/nmt']) {
      const response = await request.get(path)
      expect(response.status(), path).toBe(200)
      expect(response.headers()['content-type'], path).toBe('image/png')
      expect((await response.body()).length, path).toBeGreaterThan(10_000)
    }
    expect((await request.get('/og/en/projects/no-such-line')).status()).toBe(404)
  })
})
