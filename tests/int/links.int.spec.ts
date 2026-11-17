import { getPayload, type Payload } from 'payload'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { RichText } from '@/components/RichText'
import { httpsAddressOrNull, linkTarget, resolveLink, safeLink, withLocale } from '@/lib/links'
import { getPublishedIndex } from '@/lib/payload'
import config from '@/payload.config'
import { seed } from '@/seed'

let payload: Payload

const PAGE_SLUGS = ['links-draft', 'links-later', 'links-rich']
const PROJECT_SLUGS = ['links-draft-project']

const cleanUp = async () => {
  await payload.delete({ collection: 'pages', where: { slug: { in: PAGE_SLUGS } } })
  await payload.delete({ collection: 'projects', where: { slug: { in: PROJECT_SLUGS } } })
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await seed(payload)
  await cleanUp()
  await payload.create({
    collection: 'pages',
    data: { title: 'A draft', slug: 'links-draft', _status: 'draft' },
  })
  await payload.create({
    collection: 'projects',
    draft: true,
    data: {
      _status: 'draft',
      name: 'A draft project',
      slug: 'links-draft-project',
      summary: 'Not ready to show.',
      line: 90,
      status: 'planned',
      kind: 'product',
    },
  })
})

afterAll(cleanUp)

/** A rich text with one custom link around the word "click". */
const textWithLink = (url: string) => ({
  root: {
    type: 'root',
    version: 1,
    format: '' as const,
    indent: 0,
    direction: 'ltr' as const,
    children: [
      {
        type: 'paragraph',
        version: 1,
        format: '',
        indent: 0,
        direction: 'ltr',
        children: [
          {
            type: 'link',
            version: 3,
            format: '',
            indent: 0,
            direction: 'ltr',
            fields: { linkType: 'custom', url, newTab: false },
            children: [
              {
                type: 'text',
                version: 1,
                text: 'click',
                format: 0,
                detail: 0,
                mode: 'normal',
                style: '',
              },
            ],
          },
        ],
      },
    ],
  },
})

describe('the link rule', () => {
  it('accepts a site path or an https, mailto or tel address, and nothing else', () => {
    for (const ok of [
      '/',
      '/contact',
      '/contact#form',
      '/projects/giogio',
      'https://example.com/a?b=c',
      'mailto:hello@example.com',
      'tel:+15550100',
    ])
      expect(safeLink(ok), ok).toBe(ok)
    for (const bad of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'http://example.com',
      '//evil.example',
      '/\\evil.example',
      '/con tact',
      '/a\nb',
      'contact',
      '',
      'x'.repeat(3000),
    ])
      expect(safeLink(bad), bad).toBeNull()
  })

  it('reads a site path as the home page, contact, a page or a project, and refuses a path with its language', () => {
    expect(linkTarget('/')).toEqual({ kind: 'home' })
    expect(linkTarget('/contact?x=1#form')).toEqual({ kind: 'contact' })
    expect(linkTarget('/about')).toEqual({ kind: 'page', slug: 'about' })
    expect(linkTarget('/projects/giogio')).toEqual({ kind: 'project', slug: 'giogio' })
    expect(linkTarget('https://example.com')).toEqual({ kind: 'external' })
    for (const bad of ['/en/contact', '/a/b/c', '/About', '/projects', '/projects/a/b'])
      expect(linkTarget(bad), bad).toBeNull()
  })

  it('adds the visitor’s language to a site path only', () => {
    expect(withLocale('hr', '/')).toBe('/hr')
    expect(withLocale('hr', '/contact')).toBe('/hr/contact')
    expect(withLocale('hr', '/#form')).toBe('/hr#form')
    expect(withLocale('hr', 'https://example.com/')).toBe('https://example.com/')
  })

  it('takes an address elsewhere as https only, with no user name or password', () => {
    expect(httpsAddressOrNull('https://giogio.music')).toBe('https://giogio.music')
    for (const bad of [
      'http://giogio.music',
      'javascript:alert(1)',
      '/contact',
      'giogio.music',
      'https://user:pass@giogio.music',
      'https://giogio .music',
    ])
      expect(httpsAddressOrNull(bad), bad).toBeNull()
  })
})

describe('a site link, when the site renders it', () => {
  it('is dropped once its page is unpublished', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: { title: 'Later', slug: 'links-later', _status: 'published' },
    })
    expect(resolveLink('/links-later', await getPublishedIndex())).toBe('/links-later')
    await payload.update({ collection: 'pages', id: page.id, data: { _status: 'draft' } })
    expect(resolveLink('/links-later', await getPublishedIndex())).toBeNull()
    expect(resolveLink('/contact', await getPublishedIndex())).toBe('/contact')
  })

  it('is dropped while its project is a draft', async () => {
    const index = await getPublishedIndex()
    expect(resolveLink('/projects/giogio', index)).toBe('/projects/giogio')
    expect(resolveLink('/projects/links-draft-project', index)).toBeNull()
  })

  it('is dropped when it fails the rule, even if it reached the database some other way', () => {
    const index = {
      pages: new Set(['about']),
      projects: new Set(['giogio']),
      notes: new Set<string>(),
    }
    for (const bad of ['javascript:alert(1)', '//evil.example', '/en/about'])
      expect(resolveLink(bad, index), bad).toBeNull()
  })
})

describe('a link inside rich text', () => {
  const create = (url: string) =>
    payload.create({
      collection: 'pages',
      data: { title: 'Rich', slug: 'links-rich', _status: 'published', content: textWithLink(url) },
    })

  it('is refused at save time when it fails the rule', async () => {
    for (const bad of ['javascript:alert(1)', '//evil.example', '/en/contact'])
      await expect(create(bad), bad).rejects.toThrow()
    const ok = await create('https://example.com')
    await payload.delete({ collection: 'pages', id: ok.id })
  })

  it('keeps its words and loses its link when what it names is not public', async () => {
    const render = async (url: string) =>
      renderToStaticMarkup(
        RichText({
          data: textWithLink(url) as never,
          locale: 'hr',
          index: await getPublishedIndex(),
        }),
      )
    expect(await render('/about')).toContain('<a href="/hr/about">click</a>')
    const hidden = await render('/links-draft')
    expect(hidden).toContain('click')
    expect(hidden).not.toContain('<a')
    expect(await render('/projects/links-draft-project')).not.toContain('<a')
  })
})
