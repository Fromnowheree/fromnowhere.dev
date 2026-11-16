import os from 'node:os'
import path from 'node:path'

import { defineConfig, devices } from '@playwright/test'
import { config as loadDotenv } from 'dotenv'

/**
 * Two ways to run the end-to-end tests.
 *
 * - Default: against `pnpm dev` on :3000, reused if it is already running (the development
 *   database).
 * - Throwaway mode, switched on by E2E_PORT: a production server (`next start`) on that port,
 *   against the DATABASE_URL given in the shell (a throwaway Postgres: it runs the migrations at
 *   start, then the seed), with uploads in a temporary directory. `next dev` holds .next/dev/lock,
 *   so a second dev server could not run beside the one already open in this directory.
 *
 *   E2E_PORT=3100 DATABASE_URL=postgres://postgres:test@localhost:54330/postgres pnpm test:e2e
 *
 * Specs use relative addresses, resolved against `baseURL`.
 */

// Read before .env is loaded: throwaway mode must never fall back to the development database
// that .env names.
const shellDatabaseUrl = process.env.DATABASE_URL

// The rest of the variables from .env, without overriding the shell (as `dotenv/config` did).
loadDotenv({ quiet: true })

const e2ePort = process.env.E2E_PORT
const port = e2ePort ?? '3000'
const url = `http://localhost:${port}`

if (e2ePort) {
  if (!shellDatabaseUrl) {
    throw new Error(
      'E2E_PORT is set, so the tests run against a throwaway database: give its DATABASE_URL in ' +
        'the shell. The one in .env is the development database and is never used for this.',
    )
  }
  // Inherited by the server and by Local API helpers that run in the test process.
  process.env.MEDIA_DIR ??= path.join(os.tmpdir(), 'fnw-e2e-media')
  // The Local API helpers (tests/helpers/) boot Payload in development mode, which would push
  // the schema into the throwaway database. The server has already migrated it, and a pushed
  // database makes the next `next start` on it stop at Payload's "run in dev mode … proceed?"
  // prompt until the webServer times out. Postgres skips the push while this is set (it is
  // what `payload migrate` sets); the server runs its migrations either way.
  process.env.PAYLOAD_MIGRATING = 'true'
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* One worker, always: the spec files share one database and change site-wide state (the
     served languages, a page's published status), so two files running at once see each other's
     half-made changes. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL for relative addresses, as in `await page.goto('/en')`. */
    baseURL: url,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: e2ePort
    ? {
        // `next start` warns that output: 'standalone' wants the standalone server, but serves.
        command: `pnpm start --port ${port}`,
        url,
        reuseExistingServer: false,
        // A fresh database: the migrations and the seed run before the first answer.
        timeout: 180_000,
        env: {
          DATABASE_URL: shellDatabaseUrl!,
          PAYLOAD_SEED: 'true',
          PAYLOAD_SECRET: process.env.PAYLOAD_SECRET || 'e2e-only-secret',
          SITE_URL: url,
          MEDIA_DIR: process.env.MEDIA_DIR!,
        },
      }
    : {
        command: 'pnpm dev',
        reuseExistingServer: true,
        url,
      },
})
