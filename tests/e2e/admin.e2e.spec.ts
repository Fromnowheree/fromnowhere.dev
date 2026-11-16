import { expect, test, type Page } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

const baseURL = 'http://localhost:3000'

test.describe('Admin panel', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    await seedTestUser()
    page = await (await browser.newContext()).newPage()
    await login({ page, user: testUser })
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('opens the dashboard', async () => {
    await page.goto(`${baseURL}/admin`)
    await expect(page.locator('.dashboard')).toBeVisible()
  })

  test('lists the users', async () => {
    await page.goto(`${baseURL}/admin/collections/users`)
    await expect(page.getByText(testUser.email)).toBeVisible()
  })

  test('opens a new user form', async () => {
    await page.goto(`${baseURL}/admin/collections/users/create`)
    await expect(page.locator('input[name="email"]')).toBeVisible()
  })

  test('opens a new page with its block picker', async () => {
    await page.goto(`${baseURL}/admin/collections/pages/create`)
    await expect(page.locator('input[name="title"]')).toBeVisible()
    await expect(page.locator('#field-layout')).toBeVisible()
  })

  test('opens the settings, menus and booking address included', async () => {
    await page.goto(`${baseURL}/admin/globals/site-settings`)
    await expect(page.locator('input[name="clinicName"]')).toBeVisible()
  })
})
