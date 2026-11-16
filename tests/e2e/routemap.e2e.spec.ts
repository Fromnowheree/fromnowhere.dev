import { expect, test, type Page } from '@playwright/test'

/**
 * The route map in the home hero (docs/phase-1.md, 2), against the seeded projects: 01 Locals,
 * 02 Giogio (three addresses), 03 Nowhere's Medical Toolbox (building, dashed), 04 Gati.
 * Lighting, layout, the rail, the draw once per visit, reduced motion, forced colours, no
 * JavaScript and touch.
 */

const slugs = ['locals', 'giogio', 'nmt', 'gati']

/** A CSS colour as the browser computes it, resolved inside the map (so the map's own custom
 * properties apply), for comparing with computed styles. */
const colour = (page: Page, value: string) =>
  page.evaluate((value) => {
    const probe = document.createElement('i')
    probe.style.color = value
    document.querySelector('.map')!.append(probe)
    const resolved = getComputedStyle(probe).color
    probe.remove()
    return resolved
  }, value)

/** The computed stroke of every fan path, in line order. */
const strokes = (page: Page) =>
  page.$$eval('.map-line__fan path', (paths) => paths.map((path) => getComputedStyle(path).stroke))

/** Every colour in a line's rail parts (`::before` trunk, `::after` spur), normalised. */
const railColours = (page: Page, index: number, part: '::before' | '::after') =>
  page.evaluate(
    ({ index, part }) => {
      const li = document.querySelectorAll('.map-line')[index]
      const style = getComputedStyle(li, part)
      const found = [
        ...style.backgroundImage.matchAll(/(?:rgba?|color|oklab|oklch|lab|lch|hsla?)\([^)]*\)/g),
      ].map((match) => match[0])
      if (style.backgroundColor !== 'rgba(0, 0, 0, 0)') found.push(style.backgroundColor)
      const probe = document.createElement('i')
      li.append(probe)
      const normal = found.map((value) => {
        probe.style.color = value
        return getComputedStyle(probe).color
      })
      probe.remove()
      return normal
    },
    { index, part },
  )

/** The animations playing under the map now, with their durations. */
const mapAnimations = (page: Page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target
        return target?.closest('.map') && animation.playState === 'running'
      })
      .map((animation) => ({
        name: (animation as CSSAnimation).animationName ?? 'transition',
        duration: Number(animation.effect!.getTiming().duration),
      })),
  )

/** Records the name of every animation that starts under the map (`window.__mapStarts`). */
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

for (const colorScheme of ['dark', 'light'] as const) {
  test.describe(`the wide map at 1280, ${colorScheme}`, () => {
    test.use({ viewport: { width: 1280, height: 900 }, colorScheme })

    test.beforeEach(async ({ page }) => {
      await page.goto('/en')
      await expect(page.locator('.map-line__fan path')).toHaveCount(4)
    })

    test('hovering plate 02 lights the Giogio line and dims the others', async ({ page }) => {
      const accent = await colour(page, 'var(--accent)')
      const dim = await colour(page, 'var(--route-dim)')
      await page.locator('.map-plate').nth(1).hover()
      await expect.poll(() => strokes(page)).toEqual([dim, accent, dim, dim])
    })

    test('hovering board row 3 lights map line 3 and its dashed plate', async ({ page }) => {
      const accent = await colour(page, 'var(--accent)')
      const dim = await colour(page, 'var(--route-dim)')
      await page.locator('.board tbody tr').nth(2).hover()
      await expect.poll(() => strokes(page)).toEqual([dim, dim, accent, dim])
      const plate = page.locator('.map-line').nth(2).locator('.map-plate')
      await expect.poll(() => plate.evaluate((el) => getComputedStyle(el).borderColor)).toBe(accent)
      const ring = await plate
        .locator('.map-plate__num')
        .evaluate((el) => getComputedStyle(el).boxShadow)
      expect(ring).toContain('inset')
      expect(ring).toContain(accent)
    })

    test('focusing board row 3’s link with the keyboard lights map line 3', async ({ page }) => {
      const accent = await colour(page, 'var(--accent)')
      const dim = await colour(page, 'var(--route-dim)')
      await page.locator('.board tbody tr').nth(1).locator('a').focus()
      await page.keyboard.press('Tab')
      await expect(page.locator('.board tbody tr').nth(2).locator('a')).toBeFocused()
      await expect.poll(() => strokes(page)).toEqual([dim, dim, accent, dim])
      const plate = page.locator('.map-line').nth(2).locator('.map-plate')
      await expect.poll(() => plate.evaluate((el) => getComputedStyle(el).borderColor)).toBe(accent)
      expect(
        await plate.locator('.map-plate__num').evaluate((el) => getComputedStyle(el).boxShadow),
      ).toContain(accent)
    })

    test('Tab from the skip link reaches the plates in line order, each lighting its line', async ({
      page,
    }) => {
      const accent = await colour(page, 'var(--accent)')
      await page.keyboard.press('Tab')
      await expect(page.locator('.skip-link')).toBeFocused()
      for (let step = 0; step < 20; step++) {
        if (await page.evaluate(() => document.activeElement?.classList.contains('map-plate')))
          break
        await page.keyboard.press('Tab')
      }
      for (const [index, slug] of slugs.entries()) {
        if (index > 0) await page.keyboard.press('Tab')
        const plate = page.locator('.map-plate').nth(index)
        await expect(plate).toBeFocused()
        await expect(plate).toHaveAttribute('href', `/en/projects/${slug}`)
        await expect.poll(async () => (await strokes(page))[index]).toBe(accent)
        const outline = await plate.evaluate((el) => {
          const style = getComputedStyle(el)
          return { width: style.outlineWidth, style: style.outlineStyle }
        })
        expect(outline).toEqual({ width: '2px', style: 'solid' })
      }
    })
  })
}

test.describe('"You are here"', () => {
  test.use({ reducedMotion: 'reduce' })

  for (const width of [1280, 320])
    for (const locale of ['en', 'hr'])
      test(`never collides with a line, at ${width} in ${locale}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(`/${locale}`)
        const result = await page.evaluate(() => {
          const here = document.querySelector('.map__here')!
          here.scrollIntoView({ block: 'center' })
          const box = here.getBoundingClientRect()
          const overlaps = (other: DOMRect) =>
            other.width > 0 &&
            other.height > 0 &&
            box.left < other.right &&
            other.left < box.right &&
            box.top < other.bottom &&
            other.top < box.bottom
          const parts = [...document.querySelectorAll('.map-line__fan path, .map-line__run')].map(
            (part) => part.getBoundingClientRect(),
          )
          const rail =
            getComputedStyle(document.querySelector('.map-line__fan')!).display === 'none'
          const lines = document.querySelector('.map__lines')!.getBoundingClientRect()
          return {
            collisions: parts.filter(overlaps).length,
            rail,
            aboveLines: box.bottom <= lines.top + 0.5,
            inside:
              box.left >= 0 &&
              box.top >= 0 &&
              box.right <= window.innerWidth &&
              box.bottom <= window.innerHeight,
          }
        })
        expect(result.collisions).toBe(0)
        expect(result.inside).toBe(true)
        expect(result.rail).toBe(width < 672)
        if (result.rail) expect(result.aboveLines).toBe(true)
      })
})

test.describe('text growth on the wide map', () => {
  test.use({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })

  test('keeps every plate within its row, with no two overlapping', async ({ page }) => {
    await page.goto('/en')
    await page.addStyleTag({ content: '.map-plate, .map-plate * { font-size: 24px !important }' })
    const rows = await page.$$eval('.map-line', (lines) =>
      lines.map((li) => ({
        li: li.getBoundingClientRect().toJSON() as DOMRect,
        plate: li.querySelector('.map-plate')!.getBoundingClientRect().toJSON() as DOMRect,
      })),
    )
    expect(rows).toHaveLength(4)
    for (const { li, plate } of rows) {
      expect(plate.top).toBeGreaterThanOrEqual(li.top - 0.5)
      expect(plate.bottom).toBeLessThanOrEqual(li.bottom + 0.5)
    }
    for (let a = 0; a < rows.length; a++)
      for (let b = a + 1; b < rows.length; b++)
        expect(
          rows[a].plate.bottom <= rows[b].plate.top || rows[b].plate.bottom <= rows[a].plate.top,
        ).toBe(true)
  })
})

test.describe('the rail on a phone', () => {
  test.use({ reducedMotion: 'reduce' })

  for (const width of [320, 360, 390])
    for (const locale of ['en', 'hr'])
      test(`shows whole plates at ${width} in ${locale}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 })
        await page.goto(`/${locale}`)
        const result = await page.evaluate(() => {
          const visibleSvgs = [
            ...document.querySelectorAll('.map svg.map-line__fan, .map svg.map-line__run'),
          ].filter((svg) => svg.getBoundingClientRect().width > 0).length
          const trunks = [...document.querySelectorAll('.map-line')].map(
            (li) => getComputedStyle(li, '::before').display,
          )
          const truncated = [...document.querySelectorAll('.map-plate__name, .map-plate__where')]
            .filter((el) => el.scrollWidth > el.clientWidth)
            .map((el) => el.textContent)
          const heights = [...document.querySelectorAll('.map-plate')].map(
            (plate) => plate.getBoundingClientRect().height,
          )
          return {
            visibleSvgs,
            trunks,
            truncated,
            heights,
            scrolls: document.documentElement.scrollWidth > window.innerWidth,
          }
        })
        expect(result.visibleSvgs).toBe(0)
        expect(result.trunks).toEqual(['block', 'block', 'block', 'block'])
        expect(result.scrolls).toBe(false)
        expect(result.truncated).toEqual([])
        expect(result.heights).toHaveLength(4)
        for (const height of result.heights) expect(height).toBeGreaterThanOrEqual(44)
      })
})

test.describe('rail lighting', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: false })

  test('focusing plate 03 lights the trunk down to its spur', async ({ page }) => {
    await page.goto('/en')
    const accent = await colour(page, 'var(--accent)')
    const dim = await colour(page, 'var(--route-dim)')
    await page.locator('.map-plate').nth(1).focus()
    await page.keyboard.press('Tab')
    await expect(page.locator('.map-plate').nth(2)).toBeFocused()

    await expect.poll(async () => (await railColours(page, 2, '::before'))[0]).toBe(accent)
    const third = await railColours(page, 2, '::before')
    expect(third[0]).toBe(accent)
    expect(third[third.length - 1]).toBe(dim)
    for (const index of [0, 1]) {
      const trunk = await railColours(page, index, '::before')
      expect(trunk.length).toBeGreaterThan(0)
      expect(new Set(trunk)).toEqual(new Set([accent]))
    }
    const fourth = await railColours(page, 3, '::before')
    expect(new Set(fourth)).toEqual(new Set([dim]))
    expect(await railColours(page, 2, '::after')).toContain(accent)
  })
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } })

  test('the plates are working links, and hovering one still lights its line', async ({ page }) => {
    await page.goto('/en')
    const plates = page.locator('.map-plate')
    await expect(plates).toHaveCount(4)
    for (const [index, slug] of slugs.entries())
      await expect(plates.nth(index)).toHaveAttribute('href', `/en/projects/${slug}`)
    const accent = await colour(page, 'var(--accent)')
    await plates.nth(1).hover()
    await expect.poll(async () => (await strokes(page))[1]).toBe(accent)
    await plates.nth(3).click()
    await expect(page).toHaveURL(/\/en\/projects\/gati$/)
  })
})

test.describe('drawn once per visit', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test.beforeEach(async ({ page }) => {
    await recordStarts(page)
    await page.goto('/en', { waitUntil: 'commit' })
    await page.waitForSelector('.map')
    // Everything under the map that plays on a first visit is an entrance: slow or slower. Wait
    // until routemap.css has applied and the plates, the fans and the runs are all scheduled
    // (in their delay or playing), so the check never passes on an empty list.
    let playing: Awaited<ReturnType<typeof mapAnimations>> = []
    await expect
      .poll(async () => (playing = await mapAnimations(page)).map((animation) => animation.name), {
        intervals: [50],
      })
      .toEqual(expect.arrayContaining(['fnw-enter-sm', 'fnw-fade', 'fnw-draw']))
    for (const animation of playing)
      expect(animation.duration, animation.name).toBeGreaterThanOrEqual(280)
    await page.waitForFunction(() =>
      (window as unknown as { __mapStarts: string[] }).__mapStarts.includes('fnw-draw'),
    )
  })

  /** Nothing under the map plays, now or over the next moments. */
  const expectStill = async (page: Page) => {
    await expect(page.locator('html')).toHaveClass(/\bfnw-calm\b/)
    expect(await mapAnimations(page)).toEqual([])
    await page.waitForTimeout(1_800)
    expect(await starts(page)).toEqual([])
    expect(await mapAnimations(page)).toEqual([])
  }

  test('a first load draws the map', async ({ page }) => {
    expect(await starts(page)).toContain('fnw-draw')
    expect(await starts(page)).toContain('fnw-enter-sm')
  })

  test('a reload does not draw it again', async ({ page }) => {
    await page.reload({ waitUntil: 'commit' })
    await page.waitForSelector('.map')
    await expectStill(page)
  })

  test('a soft navigation away and back does not draw it again', async ({ page }) => {
    await page.locator('.map-plate').first().click()
    await expect(page).toHaveURL(/\/en\/projects\/locals$/)
    await resetStarts(page)
    await page.locator('.fnw-nav__brand').click()
    await expect(page).toHaveURL(/\/en$/)
    await page.waitForSelector('.map')
    await expectStill(page)
  })

  test('switching to Croatian does not draw it again', async ({ page }) => {
    // The English map finishes its draw first; only the Croatian one is watched.
    await expect.poll(() => mapAnimations(page), { timeout: 5_000 }).toEqual([])
    await resetStarts(page)
    await page.locator('a[hreflang="hr"]').first().click()
    await expect(page).toHaveURL(/\/hr$/)
    await expect(page.locator('nav.map')).toHaveAttribute('aria-label', 'Karta linija')
    await expectStill(page)
  })
})

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })

  test('shows the finished map at once, with nothing playing', async ({ page }) => {
    await recordStarts(page)
    await page.goto('/en', { waitUntil: 'commit' })
    await page.waitForSelector('.map')
    expect(await mapAnimations(page)).toEqual([])
    await page.waitForTimeout(1_000)
    expect(await starts(page)).toEqual([])
    expect(await mapAnimations(page)).toEqual([])
  })
})

test.describe('forced colours', () => {
  test.use({ reducedMotion: 'reduce' })

  test('keeps the lines, the stops and the point in system colours at 1280', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.emulateMedia({ forcedColors: 'active' })
    await page.goto('/en')
    const text = await colour(page, 'CanvasText')
    const canvas = await colour(page, 'Canvas')
    expect(text).not.toBe('rgba(0, 0, 0, 0)')
    expect(new Set(await strokes(page))).toEqual(new Set([text]))
    const fills = await page.$$eval('.map-line__run circle', (circles) =>
      circles.map((circle) => getComputedStyle(circle).fill),
    )
    expect(fills).toHaveLength(2)
    expect(new Set(fills)).toEqual(new Set([canvas]))
    const point = await page.locator('.map__point').evaluate((el) => ({
      background: getComputedStyle(el).backgroundColor,
      width: el.getBoundingClientRect().width,
    }))
    expect(point.background).toBe(text)
    expect(point.width).toBeGreaterThan(0)
  })

  test('keeps the rail and the point in system colours at 320', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    await page.emulateMedia({ forcedColors: 'active' })
    await page.goto('/en')
    const text = await colour(page, 'CanvasText')
    for (let index = 0; index < 4; index++) {
      for (const part of ['::before', '::after'] as const) {
        const colours = await railColours(page, index, part)
        expect(colours.length, `${index} ${part}`).toBeGreaterThan(0)
        // A dashed spur alternates the line with transparent gaps.
        expect(colours.filter((value) => value !== 'rgba(0, 0, 0, 0)')).not.toEqual([])
        for (const value of colours.filter((value) => value !== 'rgba(0, 0, 0, 0)'))
          expect(value, `${index} ${part}`).toBe(text)
      }
    }
    const point = await page
      .locator('.map__point')
      .evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(point).toBe(text)
  })
})

test.describe('touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('a tapped plate does not stay lit after coming back', async ({ page }) => {
    await page.goto('/en')
    const accent = await colour(page, 'var(--accent)')
    await page.locator('.map-plate').nth(1).tap()
    await expect(page).toHaveURL(/\/en\/projects\/giogio$/)
    await page.goBack()
    await expect(page).toHaveURL(/\/en$/)
    await page.waitForSelector('.map')
    await page.waitForTimeout(300)
    for (let index = 0; index < 4; index++)
      for (const part of ['::before', '::after'] as const)
        expect(await railColours(page, index, part), `${index} ${part}`).not.toContain(accent)
    const borders = await page.$$eval('.map-plate', (plates) =>
      plates.map((plate) => getComputedStyle(plate).borderColor),
    )
    expect(borders).not.toContain(accent)
  })
})
