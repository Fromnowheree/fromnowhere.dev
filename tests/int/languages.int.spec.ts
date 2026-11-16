import { createTranslator } from 'next-intl'
import { NextRequest } from 'next/server'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { GET as shareCard } from '@/app/(frontend)/og/[locale]/[[...path]]/route'
import { GET as pickLanguage } from '@/app/(frontend)/pick-language/route'
import sitemap from '@/app/sitemap'
import { isLocale } from '@/i18n/locales'
import { messages } from '@/i18n/messages'
import { acceptedLanguages, chooseLocale, LANGUAGE_PATH_HEADER, sitePath } from '@/lib/locale'
import { getMainLanguage, getServedLocales } from '@/lib/payload'
import config from '@/payload.config'
import { seed } from '@/seed'

// Outside Next, next-intl resolves to its client build, where the server's getTranslations
// refuses to run; the share cards' titles are read from the message files directly instead.
vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace?: string }) =>
    createTranslator({
      locale: isLocale(locale) ? locale : 'en',
      messages: messages[isLocale(locale) ? locale : 'en'],
      namespace: namespace as never,
      timeZone: 'UTC',
    }),
}))

let payload: Payload

const PAGE_SLUGS = ['lang-draft']
const PROJECT_SLUGS = ['lang-draft-project', 'lang-later']
const ALIASES = ['lang-draft-alias', 'lang-elsewhere', 'lang-later']

const cleanUp = async () => {
  await payload.delete({ collection: 'short-links', where: { alias: { in: ALIASES } } })
  await payload.delete({ collection: 'pages', where: { slug: { in: PAGE_SLUGS } } })
  await payload.delete({ collection: 'projects', where: { slug: { in: PROJECT_SLUGS } } })
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await seed(payload)
  await cleanUp()
})

afterAll(async () => {
  await cleanUp()
})

/** What the proxy hands the route for an address without a language. */
const arrive = (path: string, headers: Record<string, string> = {}, search = '') =>
  pickLanguage(
    new NextRequest(`http://localhost:3000/pick-language${search}`, {
      headers: { [LANGUAGE_PATH_HEADER]: path, ...headers },
    }),
  )

const card = (locale: string, path: string[] = []) =>
  shareCard(new Request(`http://localhost:3000/og/${locale}/${path.join('/')}`), {
    params: Promise.resolve({ locale, path }),
  })

const sitemapUrls = async () => (await sitemap()).map((entry) => entry.url)

/** A project that is not public yet, for the tests that need one. */
const draftProject = (slug: string, line: number) =>
  payload.create({
    collection: 'projects',
    draft: true,
    data: {
      _status: 'draft',
      name: slug,
      slug,
      summary: 'Not ready to show.',
      line,
      status: 'planned',
      kind: 'product',
    },
  })

describe('choosing a language for a visitor', () => {
  it('reads Accept-Language by preference, ignoring junk', () => {
    expect(acceptedLanguages('hr-HR,hr;q=0.9,en;q=0.5')).toEqual(['hr', 'hr', 'en'])
    expect(acceptedLanguages('en;q=0.2, hr;q=0.8')).toEqual(['hr', 'en'])
    expect(acceptedLanguages('*, de;q=0, ;;, fr')).toEqual(['fr'])
    expect(acceptedLanguages(null)).toEqual([])
  })

  it('takes the remembered language, then the browser’s, then the first served one', () => {
    expect(chooseLocale({ served: ['en', 'hr'], acceptLanguage: 'de, hr;q=0.5' })).toBe('hr')
    expect(chooseLocale({ served: ['en', 'hr'], cookie: 'hr', acceptLanguage: 'en' })).toBe('hr')
    expect(chooseLocale({ served: ['en', 'hr'], cookie: 'xx', acceptLanguage: 'hr' })).toBe('hr')
    expect(chooseLocale({ served: ['en', 'hr'], acceptLanguage: 'de' })).toBe('en')
  })

  it('never picks a language that is not served', () => {
    expect(chooseLocale({ served: ['en'], cookie: 'hr', acceptLanguage: 'hr' })).toBe('en')
    expect(chooseLocale({ served: ['hr'], acceptLanguage: 'en' })).toBe('hr')
  })

  it('keeps only a plain path on this site', () => {
    expect(sitePath('/contact')).toBe('/contact')
    for (const bad of [
      '//evil.example',
      '/\\evil.example',
      'https://evil.example',
      '',
      null,
      '/a b',
    ])
      expect(sitePath(bad), String(bad)).toBe('/')
  })
})

describe('the languages the site serves', () => {
  it('are both, always, with English the main one', async () => {
    expect(await getServedLocales()).toEqual(['en', 'hr'])
    expect(await getMainLanguage()).toBe('en')
  })
})

describe('an address without a language', () => {
  it('lands on the same page in a language the visitor reads, keeping its query', async () => {
    const response = await arrive('/contact', { 'accept-language': 'hr-HR,hr;q=0.9' }, '?x=1')
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('/hr/contact?x=1')
    expect(response.headers.get('cache-control')).toContain('no-store')
  })

  it('lands in English when nothing says which language the visitor wants', async () => {
    expect((await arrive('/')).headers.get('location')).toBe('/en')
    expect((await arrive('/about')).headers.get('location')).toBe('/en/about')
    expect((await arrive('/', { cookie: 'NEXT_LOCALE=hr' })).headers.get('location')).toBe('/hr')
  })

  it('cannot be turned into a redirect to another site', async () => {
    for (const path of ['//evil.example/x', '/\\evil.example', 'https://evil.example']) {
      const response = await arrive(path)
      expect(response.headers.get('location'), path).toMatch(/^\/(en|hr)$/)
    }
  })
})

describe('a short link', () => {
  it('leads to its project’s first address', async () => {
    const response = await arrive('/ygo')
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://yugioh.fromnowhere.dev')
    expect(response.headers.get('cache-control')).toContain('no-store')
  })

  it('leads to the project’s page here, in the visitor’s language, while it has no address', async () => {
    expect((await arrive('/nmt')).headers.get('location')).toBe('/en/projects/nmt')
    expect((await arrive('/nmt', { 'accept-language': 'hr' })).headers.get('location')).toBe(
      '/hr/projects/nmt',
    )
  })

  it('leads to the address written on it, rather than the project', async () => {
    await payload.create({
      collection: 'short-links',
      data: { alias: 'lang-elsewhere', url: 'https://example.com/somewhere' },
    })
    expect((await arrive('/lang-elsewhere')).headers.get('location')).toBe(
      'https://example.com/somewhere',
    )
  })

  it('is not followed while its project is a draft, and is once it is published', async () => {
    const project = await draftProject('lang-later', 91)
    await payload.create({
      collection: 'short-links',
      data: { alias: 'lang-later', project: project.id },
    })
    expect((await arrive('/lang-later')).headers.get('location')).toBe('/en/lang-later')
    await payload.update({ collection: 'projects', id: project.id, data: { _status: 'published' } })
    expect((await arrive('/lang-later')).headers.get('location')).toBe('/en/projects/lang-later')
  })

  it('is only ever one word: anything else gets the language redirect', async () => {
    expect((await arrive('/no-such-word')).headers.get('location')).toBe('/en/no-such-word')
    expect((await arrive('/ygo/')).headers.get('location')).toBe('/en/ygo/')
    expect((await arrive('/ygo/x')).headers.get('location')).toBe('/en/ygo/x')
  })

  it('cannot take a language, a word the site answers itself, or a page’s built-in address', async () => {
    const project = await draftProject('lang-draft-project', 92)
    for (const alias of ['en', 'hr', 'api', 'admin', 'og', 'pick-language', 'contact', 'projects'])
      await expect(
        payload.create({ collection: 'short-links', data: { alias, project: project.id } }),
        alias,
      ).rejects.toThrow()
    // Written the way an editor might, it is stored as the one word it will answer to.
    const link = await payload.create({
      collection: 'short-links',
      data: { alias: 'Lang Draft Alias', project: project.id },
    })
    expect(link.alias).toBe('lang-draft-alias')
  })

  it('needs a project or an https address to lead to', async () => {
    for (const url of [undefined, 'http://example.com', 'javascript:alert(1)', '/contact'])
      await expect(
        payload.create({ collection: 'short-links', data: { alias: 'lang-elsewhere-2', url } }),
        String(url),
      ).rejects.toThrow()
  })
})

describe('share cards and the sitemap', () => {
  it('cover the home and contact pages in both languages', async () => {
    const urls = await sitemapUrls()
    for (const locale of ['en', 'hr']) {
      expect(urls.some((url) => url.endsWith(`/${locale}`))).toBe(true)
      expect(urls.some((url) => url.endsWith(`/${locale}/contact`))).toBe(true)
      expect((await card(locale)).status).toBe(200)
      expect((await card(locale, ['contact'])).status).toBe(200)
      expect((await card(locale, ['projects', 'giogio'])).status).toBe(200)
    }
  })

  it('have no card for a language the site does not have, or a path it does not serve', async () => {
    expect((await card('de')).status).toBe(404)
    for (const path of [['no-such-page'], ['projects'], ['projects', 'nope'], ['a', 'b', 'c']])
      expect((await card('en', path)).status, path.join('/')).toBe(404)
  })

  it('list a page and give it a card only while it is published', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: { title: 'Draft', slug: 'lang-draft', _status: 'draft' },
    })
    const listed = async () => (await sitemapUrls()).some((url) => url.endsWith('/hr/lang-draft'))
    expect((await card('en', ['lang-draft'])).status).toBe(404)
    expect(await listed()).toBe(false)
    await payload.update({ collection: 'pages', id: page.id, data: { _status: 'published' } })
    expect((await card('en', ['lang-draft'])).status).toBe(200)
    expect(await listed()).toBe(true)
  })

  it('list a project and give it a card only while it is published', async () => {
    const project = await draftProject('lang-draft-project-2', 93)
    try {
      const listed = async () =>
        (await sitemapUrls()).some((url) => url.endsWith('/en/projects/lang-draft-project-2'))
      const path = ['projects', 'lang-draft-project-2']
      expect((await card('hr', path)).status).toBe(404)
      expect(await listed()).toBe(false)
      await payload.update({
        collection: 'projects',
        id: project.id,
        data: { _status: 'published' },
      })
      expect((await card('hr', path)).status).toBe(200)
      expect(await listed()).toBe(true)
    } finally {
      await payload.delete({ collection: 'projects', id: project.id })
    }
  })
})
