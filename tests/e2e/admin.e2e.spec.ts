import { expect, test, type Page } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

/**
 * The editor at /admin: signing in, the users, and the studio's own content (projects, the
 * Studio settings, short links). The checks are field names and Payload's markup, never a
 * translated label: the admin's language is configuration.
 */
test.describe('Admin panel', () => {
  let page: Page

  test.beforeAll(async ({ browser }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL!
    await seedTestUser()
    page = await (await browser.newContext({ baseURL })).newPage()
    await login({ page, serverURL: baseURL, user: testUser })
  })

  test.afterAll(async () => {
    await page.context().close()
    await cleanupTestUser()
  })

  test('opens the dashboard', async () => {
    await page.goto('/admin')
    await expect(page.locator('.dashboard')).toBeVisible()
  })

  test('lists the users', async () => {
    await page.goto('/admin/collections/users')
    await expect(page.getByText(testUser.email)).toBeVisible()
  })

  test('opens a new user form', async () => {
    await page.goto('/admin/collections/users/create')
    await expect(page.locator('input[name="email"]')).toBeVisible()
  })

  test('opens a new project with its name and addresses', async () => {
    await page.goto('/admin/collections/projects/create')
    await expect(page.locator('input[name="name"]')).toBeVisible()
    await expect(page.locator('#field-addresses')).toBeVisible()
  })

  test('opens the Studio settings with the headline', async () => {
    await page.goto('/admin/globals/studio')
    await expect(page.locator('input[name="headline"]')).toBeVisible()
  })

  test('opens a new short link with its word', async () => {
    await page.goto('/admin/collections/short-links/create')
    await expect(page.locator('input[name="alias"]')).toBeVisible()
  })
})
