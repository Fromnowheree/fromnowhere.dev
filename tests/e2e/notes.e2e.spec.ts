import { expect, test, type Page } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import { richText } from '../../src/seed/lexical'

/**
 * The notes (docs/prototypes/notes.html). The seed writes three, the number that opens them;
 * these tests take one back to a draft to see them hidden, then write two more through the Local
 * API (one on Giogio's line, one on Locals') and a draft, and look at every place notes appear.
 * Throwaway mode only (E2E_PORT): it writes to the database the server reads.
 */

test.skip(!process.env.E2E_PORT, 'Writes notes: throwaway mode (E2E_PORT) only.')
test.describe.configure({ mode: 'serial' })

const SHOTS = process.env.VISUAL_DIR ?? 'test-results/night'
const MADE = ['e2e-press-start', 'e2e-standings', 'e2e-draft']

let payload: Payload

const write = async (
  slug: string,
  date: string,
  project: string | null,
  status: 'published' | 'draft' = 'published',
) => {
  const projectId = project
    ? (await payload.find({ collection: 'projects', where: { slug: { equals: project } } }))
        .docs[0]!.id
    : undefined
  const titles: Record<string, [string, string]> = {
    'e2e-press-start': [
      'Press Start is playable in the browser',
      'Press Start se igra u pregledniku',
    ],
    'e2e-standings': ['Standings while the event runs', 'Poredak dok turnir traje'],
    'e2e-draft': ['Not ready yet', 'Još nije spremno'],
  }
  const [en, hr] = titles[slug]!
  const created = await payload.create({
    collection: 'notes',
    draft: status === 'draft',
    locale: 'en',
    data: {
      _status: status,
      slug,
      date,
      project: projectId,
      title: en,
      summary: `A short summary of ${en.toLowerCase()}.`,
      content: richText([`The text of ${en.toLowerCase()}.`]),
    },
  })
  await payload.update({
    collection: 'notes',
    id: created.id,
    locale: 'hr',
    draft: status === 'draft',
    data: { title: hr, summary: `Kratak sažetak: ${hr.toLowerCase()}.` },
  })
}

/** For a screenshot: the page as it rests, every opening finished (reduced motion). */
const finished = (page: Page) => page.emulateMedia({ reducedMotion: 'reduce' })

const noSidewaysScroll = async (page: Page) => {
  const { scroll, view } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    view: window.innerWidth,
  }))
  expect(scroll).toBeLessThanOrEqual(view)
}

test.beforeAll(async () => {
  payload = await getPayload({ config })
  await payload.delete({ collection: 'notes', where: { slug: { in: MADE } } })
})

test.afterAll(async () => {
  await payload.delete({ collection: 'notes', where: { slug: { in: MADE } } })
})

/** The seed's newest note, as a draft or published again. */
const setThird = async (status: 'draft' | 'published') => {
  const { docs } = await payload.find({
    collection: 'notes',
    where: { slug: { equals: 'notes-are-open' } },
    limit: 1,
  })
  await payload.update({
    collection: 'notes',
    id: docs[0]!.id,
    // Not `draft: true`: that saves a draft beside the published note, which stays live.
    data: { _status: status },
  })
}

test.describe('with two published', () => {
  test.beforeAll(() => setThird('draft'))
  test.afterAll(() => setThird('published'))

  test('nothing about them is public', async ({ page, request }) => {
    expect((await page.goto('/en/notes'))?.status()).toBe(404)
    expect((await page.goto('/en/notes/every-line-reports-in'))?.status()).toBe(404)
    expect((await request.get('/og/en/notes')).status()).toBe(404)
    await page.goto('/en')
    await expect(page.locator('a[href="/en/notes"]')).toHaveCount(0)
    await expect(page.locator('.home__notes')).toHaveCount(0)
    expect(await (await request.get('/sitemap.xml')).text()).not.toContain('/notes')
  })
})

test.describe('with five published', () => {
  test.beforeAll(async () => {
    await write('e2e-press-start', '2026-10-20T12:00:00.000Z', 'giogio')
    await write('e2e-standings', '2026-11-01T12:00:00.000Z', 'locals')
    await write('e2e-draft', '2026-11-17T12:00:00.000Z', null, 'draft')
  })

  test('/notes lists them newest first, a month at a time', async ({ page }) => {
    expect((await page.goto('/en/notes'))?.status()).toBe(200)
    await expect(page.locator('h1')).toHaveText('Notes')
    await expect(page.locator('.notes-log h3')).toHaveText([
      'Notes are open',
      'Every line reports in now',
      'Links arrive with a map',
      'Standings while the event runs',
      'Press Start is playable in the browser',
    ])
    await expect(page.locator('.notes-log h2')).toHaveText(['November 2026', 'October 2026'])
    // The studio's notes wear the point; a project's its line.
    const owners = page.locator('.notes-log__card .notes-owner')
    await expect(owners.nth(0)).toContainText('Fromnowhere')
    await expect(owners.nth(4)).toContainText('Giogio')
    await expect(page.locator('.site-nav__links a[href="/en/notes"]')).toHaveCount(1)
    await expect(page.locator('.site-footer a[href="/en/notes"]')).toHaveCount(1)
    await expect(page.locator('.notes-chip')).toHaveText([
      /All\s*5/,
      /01\s*Locals\s*1/,
      /02\s*Giogio\s*1/,
    ])
    await finished(page)
    await page.screenshot({ path: `${SHOTS}/notes.png`, fullPage: true })
  })

  test('a chip shows one line’s notes only', async ({ page }) => {
    await page.goto('/en/notes')
    await page.locator('.notes-chip', { hasText: 'Giogio' }).click()
    await expect(page).toHaveURL(/\/en\/notes\?line=giogio$/)
    await expect(page.locator('h1')).toHaveText('Notes on line 02')
    await expect(page.locator('.notes-log h3')).toHaveText([
      'Press Start is playable in the browser',
    ])
    await expect(page.locator('.notes-chip[aria-current="page"]')).toContainText('Giogio')
    // A made-up line shows them all.
    await page.goto('/en/notes?line=nowhere')
    await expect(page.locator('.notes-log h3')).toHaveCount(5)
  })

  test('a note on a line shows that line’s route and the way to the project', async ({ page }) => {
    await page.goto('/en/notes')
    await page.getByRole('link', { name: 'Press Start is playable in the browser' }).click()
    await expect(page).toHaveURL(/\/en\/notes\/e2e-press-start$/)
    await expect(page.locator('h1')).toHaveText('Press Start is playable in the browser')
    await expect(page.locator('.note-page .kicker')).toContainText('Line 02 · Giogio')
    await expect(page.locator('.note-page .kicker')).toContainText('October 20, 2026')
    await expect(page.locator('.prose')).toContainText('The text of press start')
    const route = page.locator('.notes-route')
    await expect(route.locator('[aria-current="page"]')).toContainText('You are here')
    await route.getByRole('link', { name: 'The project’s page' }).click()
    await expect(page).toHaveURL(/\/en\/projects\/giogio$/)
  })

  test('a note about the studio shows the newest others beside it', async ({ page }) => {
    await page.goto('/en/notes/every-line-reports-in')
    await expect(page.locator('.note-page .kicker')).toContainText('Fromnowhere')
    const route = page.locator('.notes-route--studio')
    await expect(route.locator('h2')).toHaveText('More notes')
    await expect(route.locator('li')).toHaveCount(4)
    await expect(page.locator('.prose li')).toHaveCount(3)
    await finished(page)
    await page.screenshot({ path: `${SHOTS}/note.png`, fullPage: true })
  })

  test('a draft stays out of every list and has no page', async ({ page }) => {
    expect((await page.goto('/en/notes/e2e-draft'))?.status()).toBe(404)
    await page.goto('/en/notes')
    await expect(page.locator('.notes-log')).not.toContainText('Not ready yet')
  })

  test('the home page shows the newest three under the board', async ({ page }) => {
    await page.goto('/en')
    const panel = page.locator('.home__notes')
    await expect(panel.locator('h2')).toHaveText('Latest notes')
    await expect(panel.locator('h3')).toHaveText([
      'Notes are open',
      'Every line reports in now',
      'Links arrive with a map',
    ])
    await expect(panel.locator('.notes-more')).toContainText('All notes 5')
    const order = await page.evaluate(() => {
      const board = document.querySelector('.home__board')!
      const notes = document.querySelector('.home__notes')!
      return board.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING
    })
    expect(order).toBeTruthy()
    await finished(page)
    await panel.screenshot({ path: `${SHOTS}/home-notes.png` })
  })

  test('a project page lists its own notes', async ({ page }) => {
    await page.goto('/en/projects/giogio')
    const section = page.locator('.project-notes')
    await expect(section.locator('h2')).toHaveText('Notes')
    await expect(section.locator('li')).toHaveCount(1)
    await expect(section).toContainText('Press Start is playable in the browser')
    // One note: no "only this line" link.
    await expect(section.locator('.notes-more')).toHaveCount(0)
    await page.goto('/en/projects/gati')
    await expect(page.locator('.project-notes')).toHaveCount(0)
  })

  test('speak Croatian under /hr', async ({ page }) => {
    await page.goto('/hr/notes')
    await expect(page.locator('h1')).toHaveText('Bilješke')
    await expect(page.locator('.notes-log h3').first()).toHaveText('Bilješke su otvorene')
    await page.goto('/hr/notes/e2e-press-start')
    await expect(page.locator('h1')).toHaveText('Press Start se igra u pregledniku')
    await expect(page.locator('.notes-route')).toContainText('Ovdje ste')
    await page.goto('/hr')
    await expect(page.locator('.home__notes h2')).toHaveText('Najnovije bilješke')
  })

  test('share cards, the sitemap and links without a language', async ({ page, request }) => {
    for (const path of [
      '/og/en/notes',
      '/og/en/notes/e2e-press-start',
      '/og/hr/notes/links-arrive-with-a-map',
    ]) {
      const response = await request.get(path)
      expect(response.status(), path).toBe(200)
      expect(response.headers()['content-type']).toContain('image/png')
    }
    expect((await request.get('/og/en/notes/e2e-draft')).status()).toBe(404)
    const sitemap = await (await request.get('/sitemap.xml')).text()
    expect(sitemap).toContain('/en/notes</loc>')
    expect(sitemap).toContain('/hr/notes/e2e-standings</loc>')
    expect(sitemap).not.toContain('e2e-draft')
    await page.goto('/notes')
    await expect(page).toHaveURL(/\/en\/notes$/)
  })

  test('nothing scrolls sideways on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 })
    for (const path of ['/en/notes', '/en/notes/e2e-press-start', '/en', '/en/projects/giogio']) {
      await page.goto(path)
      await noSidewaysScroll(page)
    }
    await page.goto('/en/notes')
    await finished(page)
    await page.screenshot({ path: `${SHOTS}/notes-phone.png`, fullPage: true })
  })

  test('the train runs, and nothing moves under reduced motion', async ({ browser }) => {
    const moving = await browser.newPage()
    await moving.goto('/en/notes')
    await expect
      .poll(() =>
        moving.evaluate(
          () => document.querySelector('.notes-log__train')?.getAnimations().length ?? 0,
        ),
      )
      .toBeGreaterThan(0)
    await moving.close()
    const still = await browser.newPage({ reducedMotion: 'reduce' })
    await still.goto('/en/notes')
    await still.waitForTimeout(300)
    expect(await still.evaluate(() => document.getAnimations().length)).toBe(0)
    await still.close()
  })

  test('without JavaScript every note is there and every link works', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto('/en/notes')
    await expect(page.locator('.notes-log h3')).toHaveCount(5)
    await page.getByRole('link', { name: 'Standings while the event runs' }).click()
    await expect(page.locator('h1')).toHaveText('Standings while the event runs')
    await context.close()
  })
})
