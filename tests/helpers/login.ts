import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export interface LoginOptions {
  page: Page
  serverURL?: string
  user: {
    email: string
    password: string
  }
}

/** Logs the user into the admin panel through its login page. */
export async function login({
  page,
  serverURL = 'http://localhost:3000',
  user,
}: LoginOptions): Promise<void> {
  await page.goto(`${serverURL}/admin/login`)

  await page.fill('#field-email', user.email)
  await page.fill('#field-password', user.password)
  await page.click('button[type="submit"]')

  // The admin's language is configuration, so the check is the address and the dashboard's
  // markup, never a translated label.
  await page.waitForURL(`${serverURL}/admin`)
  await expect(page.locator('.dashboard')).toBeVisible()
}
