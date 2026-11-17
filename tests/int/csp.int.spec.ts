import { describe, expect, it } from 'vitest'

import { newNonce, sitePolicy } from '@/lib/csp'

/** The site's script policy (src/lib/csp.ts); tests/e2e/csp.e2e.spec.ts checks it in a browser. */
const directive = (policy: string, name: string) =>
  policy
    .split('; ')
    .find((part) => part.startsWith(`${name} `) || part === name)
    ?.split(' ')
    .slice(1)

describe('the site’s policy', () => {
  const production = sitePolicy({ nonce: 'abc', dev: false, siteUrl: 'https://fromnowhere.dev' })

  it('lets only scripts with the nonce run, and what they load', () => {
    expect(directive(production, 'script-src')).toEqual([
      "'self'",
      "'nonce-abc'",
      "'strict-dynamic'",
    ])
  })

  it('shuts everything else to the site itself', () => {
    expect(directive(production, 'default-src')).toEqual(["'self'"])
    expect(directive(production, 'object-src')).toEqual(["'none'"])
    expect(directive(production, 'frame-src')).toEqual(["'none'"])
    expect(directive(production, 'base-uri')).toEqual(["'self'"])
    expect(directive(production, 'form-action')).toEqual(["'self'"])
    expect(directive(production, 'frame-ancestors')).toEqual(["'self'"])
    expect(directive(production, 'connect-src')).toEqual(["'self'"])
    expect(directive(production, 'upgrade-insecure-requests')).toEqual([])
  })

  it('adds eval and the reload socket in development only', () => {
    const dev = sitePolicy({ nonce: 'abc', dev: true, siteUrl: 'http://localhost:3000' })
    expect(directive(dev, 'script-src')).toContain("'unsafe-eval'")
    expect(directive(dev, 'connect-src')).toContain('ws:')
    expect(directive(dev, 'upgrade-insecure-requests')).toBeUndefined()
    expect(production).not.toContain('unsafe-eval')
    expect(production).not.toContain('ws:')
  })

  it('does not upgrade requests on a plain http site (the end-to-end server)', () => {
    const local = sitePolicy({ nonce: 'abc', dev: false, siteUrl: 'http://localhost:3100' })
    expect(directive(local, 'upgrade-insecure-requests')).toBeUndefined()
  })

  it('lets the statistics script report to its own host, an https one only', () => {
    const withStats = (statsScript: string) =>
      directive(
        sitePolicy({ nonce: 'a', dev: false, siteUrl: 'https://fromnowhere.dev', statsScript }),
        'connect-src',
      )
    expect(withStats('https://stats.example.com/script.js')).toEqual([
      "'self'",
      'https://stats.example.com',
    ])
    expect(withStats('http://stats.example.com/script.js')).toEqual(["'self'"])
    expect(withStats('https://x.example; script-src *')).toEqual(["'self'"])
    expect(withStats('not a url')).toEqual(["'self'"])
  })
})

describe('a nonce', () => {
  it('is 128 random bits, new every time', () => {
    const nonces = new Set(Array.from({ length: 100 }, newNonce))
    expect(nonces.size).toBe(100)
    for (const nonce of nonces) expect(atob(nonce)).toHaveLength(16)
  })
})
