import { expect, test, type Page } from '@playwright/test'

/**
 * The home page in Night transit (docs/prototypes/night-transit.html), against the seeded
 * projects: 01 Locals, 02 Giogio (three addresses), 03 Nowhere's Medical Toolbox (building),
 * 04 Gati (the seed starts Locals and Giogio as building; tests/helpers/inService.ts sets them
 * running for these specs). The opening on every visit (held until the map, under the hero's screen, comes into
 * view), the trains, lighting between the map and the board, the phone map, reduced motion, no
 * JavaScript, touch targets and forced colours. And the way down the page: a scroll settling on
 * the map and the board, the bands under them arriving, the strip map of the page's stops.
 */

const slugs = ['locals', 'giogio', 'nmt', 'gati']

/** The trains' animations on the page now: their line, state and speed. */
const trains = (page: Page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) =>
        ((animation.effect as KeyframeEffect | null)?.target as Element | null)?.classList.contains(
          'train',
        ),
      )
      .map((animation) => {
        const target = (animation.effect as KeyframeEffect).target as Element
        return {
          line: target.closest('.line')?.getAttribute('data-line'),
          state: animation.playState,
          rate: animation.playbackRate,
        }
      }),
  )

/** Names of the CSS animations that have started under the map since the page began. */
const recordStarts = (page: Page) =>
  page.addInitScript(() => {
    const record = window as unknown as { __mapStarts: string[] }
    record.__mapStarts = []
    document.addEventListener(
      'animationstart',
      (event) => {
        if ((event.target as Element).closest?.('.map'))
          record.__mapStarts.push(event.animationName)
      },
      true,
    )
  })
const starts = (page: Page) =>
  page.evaluate(() => (window as unknown as { __mapStarts: string[] }).__mapStarts)
const resetStarts = (page: Page) =>
  page.evaluate(() => {
    ;(window as unknown as { __mapStarts: string[] }).__mapStarts = []
  })

/**
 * The map is under the hero's screen, its opening held until it comes into view: bring it there.
 * HomeMotion is listening (and holding the opening) once the map is live.
 */
const toMap = async (page: Page) => {
  await expect(page.locator('#route-map')).toHaveClass(/is-live/)
  await page.locator('#route-map').scrollIntoViewIfNeeded()
}

/** The play states of the opening's animations (the ones that end) under the map now. */
const openingStates = (page: Page) =>
  page.evaluate(() => [
    ...new Set(
      document
        .getElementById('route-map')!
        .getAnimations({ subtree: true })
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.playState),
    ),
  ])

const lineOpacity = (page: Page, slug: string) =>
  page
    .locator(`.map__svg--wide .line[data-line="${slug}"]`)
    .evaluate((el) => Number(getComputedStyle(el).opacity))

test.describe('the wide map at 1440', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/en')
    await expect(page.locator('.map__svg--wide .line')).toHaveCount(4)
    // HomeMotion is listening: pointing and focus light lines only from here on. In view, the
    // map draws and its trains set off.
    await toMap(page)
  })

  test('shows the wide drawing, its terminals with their labels to the right', async ({ page }) => {
    await expect(page.locator('.map__svg--wide')).toBeVisible()
    await expect(page.locator('.map__svg--tall')).toBeHidden()
    for (const slug of slugs) {
      const terminal = await page
        .locator(`.map__svg--wide .line[data-line="${slug}"] .line__terminal`)
        .boundingBox()
      const card = await page.locator(`.term[data-line="${slug}"]`).boundingBox()
      expect(card!.x).toBeGreaterThan(terminal!.x + terminal!.width)
      expect(
        Math.abs(card!.y + card!.height / 2 - (terminal!.y + terminal!.height / 2)),
      ).toBeLessThan(4)
    }
  })

  test('the trains run once the lines are drawn, one or more on every working line', async ({
    page,
  }) => {
    await expect.poll(async () => (await trains(page)).length, { timeout: 8_000 }).toBe(8)
    const running = await trains(page)
    expect(running.every((train) => train.state === 'running' && train.rate === 1)).toBe(true)
    expect(running.filter((train) => train.line === 'giogio')).toHaveLength(3)
    expect(running.filter((train) => train.line === 'nmt')).toHaveLength(1)
  })

  test('a train arriving pulses its terminal', async ({ page }) => {
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            document
              .getAnimations()
              .some((animation) =>
                (
                  (animation.effect as KeyframeEffect | null)?.target as Element | null
                )?.classList.contains('line__pulse'),
              ),
          ),
        { timeout: 15_000, intervals: [100] },
      )
      .toBe(true)
  })

  test('pointing at terminal 02 lights the Giogio line and its row, dims the rest and speeds its trains up', async ({
    page,
  }) => {
    await expect.poll(async () => (await trains(page)).length, { timeout: 8_000 }).toBe(8)
    await page.locator('.term[data-line="giogio"] .term__name').hover()
    await expect(page.locator('#route-map')).toHaveAttribute('data-active', 'giogio')
    await expect(page.locator('.map__svg--wide .line[data-line="giogio"]')).toHaveClass(/is-active/)
    await expect(page.locator('.row[data-line="giogio"]')).toHaveClass(/is-active/)
    await expect.poll(() => lineOpacity(page, 'locals')).toBeLessThan(0.2)
    expect(await lineOpacity(page, 'giogio')).toBe(1)
    await expect
      .poll(async () => (await trains(page)).filter((t) => t.line === 'giogio').map((t) => t.rate))
      .toEqual([3, 3, 3])
    expect((await trains(page)).filter((t) => t.line !== 'giogio').every((t) => t.rate === 1)).toBe(
      true,
    )

    await page.mouse.move(5, 5)
    await expect(page.locator('#route-map')).not.toHaveAttribute('data-active')
    await expect.poll(() => lineOpacity(page, 'locals')).toBe(1)
    await expect.poll(async () => (await trains(page)).every((t) => t.rate === 1)).toBe(true)
  })

  test('pointing at a line lights it, and its stroke opens the project', async ({ page }) => {
    const line = page.locator('.map__svg--wide .line[data-line="locals"] .line__terminal')
    await line.scrollIntoViewIfNeeded()
    const box = (await line.boundingBox())!
    // Along the run, left of the terminal.
    await page.mouse.move(box.x - 120, box.y + box.height / 2)
    await expect(page.locator('#route-map')).toHaveAttribute('data-active', 'locals')
    await page.mouse.click(box.x - 120, box.y + box.height / 2)
    await expect(page).toHaveURL(/\/en\/projects\/locals$/)
  })

  test('pointing at board row 03 lights map line 03', async ({ page }) => {
    await page.locator('.row[data-line="nmt"]').hover()
    await expect(page.locator('#route-map')).toHaveAttribute('data-active', 'nmt')
    await expect(page.locator('.term[data-line="nmt"]')).toHaveClass(/is-active/)
    await expect(page.locator('.row[data-line="nmt"]')).toHaveClass(/is-active/)
  })

  test('focusing a board link with the keyboard lights its map line', async ({ page }) => {
    await page.locator('.row[data-line="giogio"] .row__dest a').focus()
    await page.keyboard.press('Tab')
    await expect(page.locator('.row[data-line="giogio"] .row__addr a').first()).toBeFocused()
    await expect(page.locator('#route-map')).toHaveAttribute('data-active', 'giogio')
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Shift+Tab')
    await expect(page.locator('#route-map')).toHaveAttribute('data-active', 'locals')
  })

  test('Tab from the skip link reaches the terminals in line order, each lighting its line with a visible focus', async ({
    page,
  }) => {
    await page.keyboard.press('Tab')
    await expect(page.locator('.skip-link')).toBeFocused()
    for (let step = 0; step < 20; step++) {
      if (await page.evaluate(() => document.activeElement?.classList.contains('term__name'))) break
      await page.keyboard.press('Tab')
    }
    for (const [index, slug] of slugs.entries()) {
      if (index > 0) await page.keyboard.press('Tab')
      const name = page.locator(`.term[data-line="${slug}"] .term__name`)
      await expect(name).toBeFocused()
      await expect(name).toHaveAttribute('href', `/en/projects/${slug}`)
      await expect(page.locator('#route-map')).toHaveAttribute('data-active', slug)
      const ring = await name.evaluate((el) => {
        const style = getComputedStyle(el, '::after')
        return { width: style.outlineWidth, style: style.outlineStyle }
      })
      expect(ring).toEqual({ width: '2px', style: 'solid' })
    }
    // After the four terminals, the board.
    await page.keyboard.press('Tab')
    await expect(page.locator('.row[data-line="locals"] .row__dest a')).toBeFocused()
  })
})

test.describe('the opening, on every visit', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test.beforeEach(async ({ page }) => {
    await recordStarts(page)
    await page.goto('/en', { waitUntil: 'commit' })
    await page.waitForSelector('.map')
  })

  /**
   * Once the map is in view, the lines draw out of the point one after another and the terminals
   * light. Counted from the moment the island holds the opening, so nothing that began unseen
   * while the page arrived is taken for it.
   */
  const expectOpening = async (page: Page) => {
    await expect(page.locator('#route-map')).toHaveClass(/is-live/)
    await resetStarts(page)
    await toMap(page)
    await expect
      .poll(async () => (await starts(page)).filter((name) => name === 'map-draw').length, {
        timeout: 5_000,
      })
      .toBeGreaterThanOrEqual(8) // a main stroke and a glow per line
    await expect.poll(async () => starts(page), { timeout: 5_000 }).toContain('map-pop')
    expect(await starts(page)).toContain('map-label')
    expect(await starts(page)).toContain('map-core')
  }

  test('waits under the hero’s screen, and draws nothing until the map is in view', async ({
    page,
  }) => {
    const map = page.locator('#route-map')
    await expect(map).toHaveClass(/is-live/)
    expect(await map.evaluate((el) => el.getBoundingClientRect().top >= innerHeight)).toBe(true)
    await resetStarts(page)
    // Longer than the first line's delay: were it playing, lines would have left by now.
    await page.waitForTimeout(1_500)
    expect(await openingStates(page)).toEqual(['paused'])
    // The ambient loops (the point's rings, work lights) run meanwhile; the opening does not.
    const begun = await starts(page)
    for (const name of ['map-core', 'map-draw', 'map-pop', 'map-label'])
      expect(begun).not.toContain(name)
    await expect(map).not.toHaveClass(/is-settled/)
    // Held at its first frame: no line drawn yet, no card shown.
    expect(
      await page.$$eval('.term', (cards) =>
        cards.map((card) => Number(getComputedStyle(card).opacity)),
      ),
    ).toEqual([0, 0, 0, 0])

    await map.scrollIntoViewIfNeeded()
    await expect.poll(() => openingStates(page)).toEqual(['running'])
    await expect(map).toHaveClass(/is-settled/, { timeout: 6_000 })
    expect(
      await page.$$eval('.term', (cards) =>
        cards.map((card) => Number(getComputedStyle(card).opacity)),
      ),
    ).toEqual([1, 1, 1, 1])
  })

  test('draws the map on the first load, lines leaving one after another', async ({ page }) => {
    await expectOpening(page)
    const delays = await page.$$eval('.map__svg--wide .line .line__main', (paths) =>
      paths.map((path) => getComputedStyle(path).animationDelay),
    )
    const ms = delays.map((delay) => parseFloat(delay) * (delay.endsWith('ms') ? 1 : 1000))
    for (let i = 1; i < ms.length; i++) expect(ms[i]).toBeGreaterThan(ms[i - 1])
    // Midway, the map is still being drawn; at the end it is whole.
    await expect(page.locator('#route-map')).toHaveClass(/is-settled/, { timeout: 6_000 })
  })

  test('draws it again on a reload', async ({ page }) => {
    await expectOpening(page)
    await page.reload({ waitUntil: 'commit' })
    await page.waitForSelector('.map')
    await expectOpening(page)
  })

  test('draws it again after a soft navigation away and back', async ({ page }) => {
    await expectOpening(page)
    await page.locator('.term[data-line="locals"] .term__name').click()
    await expect(page).toHaveURL(/\/en\/projects\/locals$/)
    await resetStarts(page)
    await page.locator('.site-nav .fnw-nav__brand').click()
    await expect(page).toHaveURL(/\/en$/)
    await page.waitForSelector('.map')
    await expectOpening(page)
  })

  test('draws it again in the other language', async ({ page }) => {
    await expectOpening(page)
    await resetStarts(page)
    await page.locator('a[hreflang="hr"]').first().click()
    await expect(page).toHaveURL(/\/hr$/)
    await expect(page.locator('nav.map')).toHaveAttribute('aria-label', 'Karta linija')
    await expectOpening(page)
  })
})

test.describe('the trains rest when nobody can see them', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('while the map is off screen, and while the tab is hidden', async ({ page }) => {
    await page.goto('/en')
    await toMap(page)
    await expect.poll(async () => (await trains(page)).length, { timeout: 8_000 }).toBe(8)

    await page.locator('.site-footer').scrollIntoViewIfNeeded()
    await expect
      .poll(async () => (await trains(page)).every((train) => train.state === 'paused'))
      .toBe(true)
    await page.locator('#route-map').scrollIntoViewIfNeeded()
    await expect
      .poll(async () => (await trains(page)).every((train) => train.state === 'running'))
      .toBe(true)

    const setHidden = (hidden: boolean) =>
      page.evaluate((hidden) => {
        Object.defineProperty(document, 'hidden', { value: hidden, configurable: true })
        document.dispatchEvent(new Event('visibilitychange'))
      }, hidden)
    await setHidden(true)
    await expect
      .poll(async () => (await trains(page)).every((train) => train.state === 'paused'))
      .toBe(true)
    await setHidden(false)
    await expect
      .poll(async () => (await trains(page)).every((train) => train.state === 'running'))
      .toBe(true)
  })
})

test.describe('the board', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('shows the visitor’s local time, ticking', async ({ page }) => {
    await page.goto('/en')
    const clock = page.locator('.clock time')
    await expect(clock).toBeVisible()
    await expect(clock).toHaveText(/^\d\d:\d\d:\d\d$/)
    const first = await clock.textContent()
    await expect.poll(() => clock.textContent(), { timeout: 3_000 }).not.toBe(first)
  })

  test('its rows wait below the fold, then sweep in, and end fully shown', async ({ page }) => {
    await page.goto('/en')
    const board = page.locator('#departures')
    await expect(board).toHaveClass(/is-pending/)
    await board.scrollIntoViewIfNeeded()
    await expect(board).toHaveClass(/is-arrived/)
    await expect
      .poll(() =>
        page.$$eval('.row > .row__dest', (cells) =>
          cells.map((cell) => Number(getComputedStyle(cell).opacity)),
        ),
      )
      .toEqual([1, 1, 1, 1])
  })
})

test.describe('the way down the page', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  const top = (page: Page, id: string) =>
    page.evaluate((id) => Math.round(document.getElementById(id)!.getBoundingClientRect().top), id)
  /** Turns of a mouse wheel, close together, then long enough for the scroll to come to rest. */
  const wheel = async (page: Page, turns: number, by = 100) => {
    for (let i = 0; i < turns; i++) {
      await page.mouse.wheel(0, by)
      await page.waitForTimeout(40)
    }
    await page.waitForTimeout(1_200)
  }
  const here = (page: Page) => page.locator('.strip a[aria-current="location"]')

  test.beforeEach(async ({ page }) => {
    await page.goto('/en')
    await expect(page.locator('#route-map')).toHaveClass(/is-live/)
    await page.mouse.move(720, 450)
  })

  test('a scroll that ends near the map settles on it, then on the board, and neither pulls back', async ({
    page,
  }) => {
    // Near the top the page scrolls freely: the map is too far to reach. (A wheel's turn is
    // 100px, give or take a few.)
    await wheel(page, 2)
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(180)
    expect(await page.evaluate(() => scrollY)).toBeLessThan(220)
    // Close to the map, the scroll comes to rest with the map's head under the window's top.
    await wheel(page, 3)
    expect(await top(page, 'map')).toBe(16)
    // Reached, it lets go: one turn on, and two back, stay where they are put.
    await wheel(page, 1)
    expect(await top(page, 'map')).toBeLessThan(-60)
    expect(await top(page, 'map')).toBeGreaterThan(-110)
    await wheel(page, 2, -100)
    expect(await top(page, 'map')).toBeGreaterThan(90)
    expect(await top(page, 'map')).toBeLessThan(140)
    // The board is the next screen.
    await wheel(page, 7)
    expect(await top(page, 'board')).toBe(16)
    await wheel(page, 1)
    expect(await top(page, 'board')).toBeLessThan(-60)
    expect(await top(page, 'board')).toBeGreaterThan(-110)
    // Nothing under it is a screen: the bands scroll freely.
    await expect(page.locator('.home > .is-next')).toHaveCount(0)
  })

  test('the bands under the board wait below the window, then arrive, and end fully shown', async ({
    page,
  }) => {
    const bands = page.locator('.home > :is(.offer, .works-band, .home__notes, .band)')
    await expect(bands).toHaveCount(4)
    for (const band of await bands.all()) await expect(band).toHaveClass(/is-pending/)
    await expect(page.locator('#services .sign').first()).toHaveCSS('opacity', '0')

    await page.locator('#services').scrollIntoViewIfNeeded()
    await expect(page.locator('#services')).toHaveClass(/is-arrived/)
    await expect(page.locator('#services .sign').last()).toHaveCSS('opacity', '1')
    // The ones still below wait.
    await expect(page.locator('#start')).toHaveClass(/is-pending/)

    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight))
    for (const band of await bands.all()) await expect(band).toHaveClass(/is-arrived/)
    await expect(page.locator('#start .btn')).toBeVisible()
    await expect(page.locator('#start > div').first()).toHaveCSS('opacity', '1')
  })

  test('the strip map names the page’s stops and follows the visitor down them', async ({
    page,
  }) => {
    const strip = page.getByRole('navigation', { name: 'On this page' })
    await expect(strip.getByRole('link')).toHaveText([
      'FNW Studio',
      'Route map',
      'Departures',
      'Services',
      'The works',
      'Notes',
      'Start a project',
    ])
    await expect(here(page)).toHaveText('FNW Studio')

    await page.locator('#board').scrollIntoViewIfNeeded()
    await page.evaluate(() => document.getElementById('board')!.scrollIntoView())
    await expect(here(page)).toHaveText('Departures')
    await expect(page.locator('.strip li.is-passed')).toHaveCount(2)

    // The foot of the page is the last stop's, though its band never reaches the middle.
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight))
    await expect(here(page)).toHaveText('Start a project')

    // It stays where it is while the page scrolls under it.
    const box = await strip.boundingBox()
    expect(box!.y).toBe((900 - 7 * 44) / 2)
  })

  test('a stop is a link: it rides to its section, which stays the one lit', async ({ page }) => {
    await page.locator('.strip a[href="#services"]').click()
    await expect(here(page)).toHaveText('Services')
    await expect.poll(() => top(page, 'services')).toBe(16)
    expect(new URL(page.url()).hash).toBe('#services')
    await expect(page.locator('#services')).toHaveClass(/is-arrived/)
    // The ride over, the page scrolls as it did before.
    await expect(page.locator('html')).not.toHaveClass(/is-travelling/)

    await page.locator('.strip a[href="#top"]').click()
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
    await expect(here(page)).toHaveText('FNW Studio')
  })

  test('with the keyboard, a stop shows its name and takes a visible focus', async ({ page }) => {
    const link = page.locator('.strip a[href="#map"]')
    await expect(link.locator('.strip__name')).toHaveCSS('opacity', '0')
    await link.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(link).toBeFocused()
    await expect(link.locator('.strip__name')).toHaveCSS('opacity', '1')
    expect(await link.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid')
  })
})

test.describe('the way down the page on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('has no strip map, and the page is no wider than the window', async ({ page }) => {
    await page.goto('/en')
    await expect(page.locator('#route-map')).toHaveClass(/is-live/)
    await expect(page.locator('.strip')).toBeHidden()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
    // The map is still the next screen a drag settles on.
    await expect(page.locator('#map')).toHaveClass(/is-next/)
  })
})

test.describe('the tall map on a phone', () => {
  for (const width of [320, 375])
    for (const locale of ['en', 'hr'])
      test(`at ${width} in ${locale}: the tall drawing, whole cards, no sideways scroll`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 800 })
        await page.goto(`/${locale}`)
        await expect(page.locator('.map__svg--tall')).toBeVisible()
        await expect(page.locator('.map__svg--wide')).toBeHidden()
        const result = await page.evaluate(() => {
          const cards = [...document.querySelectorAll('.term')].map((card) =>
            card.getBoundingClientRect(),
          )
          return {
            scrolls: document.documentElement.scrollWidth > window.innerWidth,
            outside: cards.filter((box) => box.right > window.innerWidth + 0.5).length,
            overlaps: cards.filter((box, i) => i > 0 && box.top < cards[i - 1].bottom - 0.5).length,
            heights: cards.map((box) => box.height),
          }
        })
        expect(result.scrolls).toBe(false)
        expect(result.outside).toBe(0)
        expect(result.overlaps).toBe(0)
        for (const height of result.heights) expect(height).toBeGreaterThanOrEqual(44)
      })
})

test.describe('touch targets', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

  test('every control on the home page is at least 44px tall', async ({ page }) => {
    await page.goto('/en')
    const small = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          '.site-nav a, .hero__actions a, .term, .row a, .offer__head a, .band a, .site-footer a',
        ),
      ]
        // Shown only: a link the phone layout hides (About, in the footer instead) has no box.
        .filter((el) => el.getClientRects().length > 0)
        .map((el) => ({ el: el.outerHTML.slice(0, 80), height: el.getBoundingClientRect().height }))
        .filter(({ height }) => height < 44),
    )
    expect(small).toEqual([])
  })

  test('a terminal’s whole card opens its project', async ({ page }) => {
    await page.goto('/en')
    await page.locator('.term[data-line="gati"]').scrollIntoViewIfNeeded()
    const card = (await page.locator('.term[data-line="gati"]').boundingBox())!
    await page.touchscreen.tap(card.x + card.width - 8, card.y + card.height - 6)
    await expect(page).toHaveURL(/\/en\/projects\/gati$/)
  })
})

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })

  test('shows the finished map at once, with nothing moving: no trains, pulses, ticker or haze', async ({
    page,
  }) => {
    await recordStarts(page)
    await page.goto('/en')
    await page.waitForTimeout(2_500)
    expect(await starts(page)).toEqual([])
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)
    const drawn = await page.$$eval('.map__svg--wide .line--running .line__main', (paths) =>
      paths.map((path) => getComputedStyle(path).strokeDasharray),
    )
    expect(drawn).toEqual(['none', 'none', 'none'])
    const cards = await page.$$eval('.term', (cards) =>
      cards.map((card) => Number(getComputedStyle(card).opacity)),
    )
    expect(cards).toEqual([1, 1, 1, 1])
    // The ticker stands still and wraps, so all of it can be read.
    expect(
      await page
        .locator('.ticker__copy')
        .first()
        .evaluate((el) => getComputedStyle(el).whiteSpace),
    ).toBe('normal')
    // The clock still tells the time.
    await expect(page.locator('.clock time')).toHaveText(/^\d\d:\d\d:\d\d$/)
  })

  test('nothing settles, waits or rides: the page scrolls as it is, and the strip map still says where', async ({
    page,
  }) => {
    await page.goto('/en')
    await expect(page.locator('#route-map')).toHaveClass(/is-live/)
    await expect(page.locator('html')).not.toHaveClass(/is-settling/)
    await expect(page.locator('.home > :is(.is-pending, .is-next)')).toHaveCount(0)
    await page.locator('.strip a[href="#services"]').click()
    await expect(page.locator('.strip a[aria-current="location"]')).toHaveText('Services')
    expect(
      await page.evaluate(() =>
        Math.round(document.getElementById('services')!.getBoundingClientRect().top),
      ),
    ).toBe(16)
  })

  test('still lights a line when a terminal is pointed at', async ({ page }) => {
    await page.goto('/en')
    await page.locator('.term[data-line="giogio"] .term__name').hover()
    await expect(page.locator('#route-map')).toHaveAttribute('data-active', 'giogio')
  })
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } })

  test('the map and the board read and every link works', async ({ page }) => {
    await page.goto('/en')
    for (const slug of slugs) {
      await expect(page.locator(`.term[data-line="${slug}"] .term__name`)).toHaveAttribute(
        'href',
        `/en/projects/${slug}`,
      )
      await expect(page.locator(`.row[data-line="${slug}"] .row__dest a`)).toHaveAttribute(
        'href',
        `/en/projects/${slug}`,
      )
    }
    await expect(page.locator('.row[data-line="gati"] .row__addr a')).toHaveAttribute(
      'href',
      'https://www.gati.hr',
    )
    // No made-up time: without a script there is no clock.
    await expect(page.locator('.clock')).toBeHidden()
    // The opening is CSS and ends with the whole map.
    await page.waitForTimeout(3_500)
    expect(
      await page.$$eval('.term', (cards) =>
        cards.map((card) => Number(getComputedStyle(card).opacity)),
      ),
    ).toEqual([1, 1, 1, 1])
    await page.locator('.term[data-line="gati"] .term__name').click()
    await expect(page).toHaveURL(/\/en\/projects\/gati$/)
  })

  test('the strip map’s stops are plain links to the sections, and nothing waits out of sight', async ({
    page,
  }) => {
    await page.goto('/en')
    await expect(page.locator('.strip a[aria-current]')).toHaveCount(0)
    await expect(page.locator('#services .sign').first()).toHaveCSS('opacity', '1')
    await page.locator('.strip a[href="#works"]').click()
    await expect(page).toHaveURL(/\/en#works$/)
    expect(
      await page.evaluate(() =>
        Math.round(document.getElementById('works')!.getBoundingClientRect().top),
      ),
    ).toBe(16)
  })
})

test.describe('forced colours', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })

  test('draws the lines, terminals and the point in system colours', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' })
    await page.goto('/en')
    const colours = await page.evaluate(() => {
      const probe = document.createElement('i')
      probe.style.color = 'CanvasText'
      document.body.append(probe)
      const text = getComputedStyle(probe).color
      probe.remove()
      const strokes = [...document.querySelectorAll('.map__svg--wide .line__main')].map(
        (path) => getComputedStyle(path).stroke,
      )
      const point = getComputedStyle(document.querySelector('.map__svg--wide .origin__core')!).fill
      return { text, strokes, point }
    })
    expect(new Set(colours.strokes)).toEqual(new Set([colours.text]))
    expect(colours.point).toBe(colours.text)
  })
})
