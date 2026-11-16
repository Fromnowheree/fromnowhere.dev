import {
  getRewrittenUrl,
  unstable_doesMiddlewareMatch as runsOn,
} from 'next/experimental/testing/server'
import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { config, proxy } from '@/proxy'

/**
 * Which addresses go through the language routing (src/proxy.ts). Payload (/admin, /api), the
 * share cards (/og), Next's own files and files with an extension are left alone, but only as
 * WHOLE path segments: a page whose slug merely starts with one of those words (Croatian
 * "ogledi", "administracija", "apiterapija") is a page like any other and needs its language.
 */

const matches = (url: string) => runsOn({ config, url })

describe('the language routing', () => {
  it('leaves Payload, the share cards, Next’s files and files alone', () => {
    for (const url of [
      '/api',
      '/api/users/me',
      '/api/contact/challenge',
      '/admin',
      '/admin/collections/pages',
      '/og',
      '/og/en/contact',
      '/_next/static/chunks/main.js',
      '/_vercel/insights',
      '/robots.txt',
      '/sitemap.xml',
      '/media/logo.svg',
    ])
      expect(matches(url), url).toBe(false)
  })

  it('takes every page, including one whose slug starts with og, api or admin', () => {
    for (const url of [
      '/',
      '/contact',
      '/ogledi',
      '/og-cards',
      '/administracija',
      '/admins',
      '/apiterapija',
      '/api-docs',
      '/_nextsteps',
      '/en',
      '/hr/ogledi',
      '/projects/ogled',
    ])
      expect(matches(url), url).toBe(true)
  })

  it('sends such a page to a language instead of a 404', () => {
    const response = proxy(new NextRequest('http://localhost:3000/ogledi'))
    expect(getRewrittenUrl(response)).toBe('http://localhost:3000/pick-language')
  })
})
