import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { routing } from '@/i18n/routing'
import { MIN_SECRET_LENGTH, weakSecret } from '@/lib/secret'

/**
 * PAYLOAD_SECRET signs the editor's session and derives the contact form's keys and the
 * provisioning token. Production refuses one that could be guessed (src/lib/secret.ts, checked
 * by src/instrumentation.node.ts before Payload boots).
 */
describe('the secret production accepts', () => {
  it('is what `openssl rand -hex 32` gives', () => {
    expect(
      weakSecret('9f2c4a1e7b3d5f60819a2b4c6d8e0f13579bdf02468ace13579bdf02468ace1f'),
    ).toBeNull()
  })

  it('is never missing, short, or a few characters repeated', () => {
    expect(weakSecret(undefined)).toBe('it is not set')
    expect(weakSecret('')).toBe('it is not set')
    expect(weakSecret('change-me')).toContain(`shorter than ${MIN_SECRET_LENGTH}`)
    // The build's placeholder (Dockerfile) can never be a running server's secret.
    expect(weakSecret('build-only')).not.toBeNull()
    expect(weakSecret('a'.repeat(64))).toBe('it repeats only a few characters')
    expect(weakSecret('abab'.repeat(16))).not.toBeNull()
  })

  it('is checked before Payload boots, and only in production', () => {
    const start = readFileSync(path.resolve('src/instrumentation.node.ts'), 'utf8')
    expect(start).toContain("process.env.NODE_ENV === 'production'")
    expect(start.indexOf('weakSecret(process.env.PAYLOAD_SECRET)')).toBeGreaterThan(0)
    expect(start.indexOf('weakSecret(process.env.PAYLOAD_SECRET)')).toBeLessThan(
      start.indexOf('await getPayload('),
    )
  })

  it('is longer than the minimum in the end-to-end suite, which runs a production server', () => {
    const config = readFileSync(path.resolve('playwright.config.ts'), 'utf8')
    const fallback = config.match(/PAYLOAD_SECRET: process\.env\.PAYLOAD_SECRET \|\| '([^']+)'/)
    expect(weakSecret(fallback?.[1])).toBeNull()
  })
})

describe('the language cookie', () => {
  it('is Secure in production and plain in development, where the site runs on http://', () => {
    // The tests run outside production.
    expect(routing.localeCookie).toEqual({ secure: false })
    const source = readFileSync(path.resolve('src/i18n/routing.ts'), 'utf8')
    expect(source).toContain("localeCookie: { secure: process.env.NODE_ENV === 'production' }")
  })
})
