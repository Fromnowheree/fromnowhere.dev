import { expect, test } from '@playwright/test'

/**
 * Every address under a language that leads nowhere gets the site's own 404, at any depth: in the
 * page's language, at night, with the header. Before `(site)/[...rest]`, two segments or more fell
 * through to Next's bare white page.
 */
const cases = [
  { path: '/en/nope', lang: 'en', title: 'This line doesn’t go anywhere' },
  { path: '/en/projects/no-such-line', lang: 'en', title: 'This line doesn’t go anywhere' },
  { path: '/hr/a/b/c', lang: 'hr', title: 'Ova linija ne vodi nikamo' },
  { path: '/en/projects/giogio/extra', lang: 'en', title: 'This line doesn’t go anywhere' },
  { path: '/hr/contact/x', lang: 'hr', title: 'Ova linija ne vodi nikamo' },
]

for (const { path, lang, title } of cases) {
  test(`${path} answers 404 with the site's own page`, async ({ page }) => {
    const response = await page.goto(path)
    expect(response?.status()).toBe(404)
    await expect(page.locator('html')).toHaveAttribute('lang', lang)
    await expect(page.locator('h1')).toHaveText(title)
    await expect(page.locator('header').first()).toBeVisible()
    const background = await page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor,
    )
    expect(background).toBe('rgb(5, 6, 15)')
  })
}
