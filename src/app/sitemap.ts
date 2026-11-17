import type { MetadataRoute } from 'next'

import type { Locale } from '@/i18n/locales'
import { noteHref, notesHref, pageHref, projectHref } from '@/lib/links'
import { localizedPath } from '@/lib/metadata'
import { getPublishedSummaries, getServedLocales } from '@/lib/payload'
import { serverUrl } from '@/lib/serverUrl'

export const dynamic = 'force-dynamic'

/**
 * The home page, the contact page, every published page and project and (while they are open) the
 * notes, in every language, each
 * entry naming its other languages so a search engine pairs them. Paths are the same in every
 * language; a draft is absent.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [served, { pages, projects, notes }] = await Promise.all([
    getServedLocales(),
    getPublishedSummaries(),
  ])

  const paths: { path: string; lastModified?: string }[] = [
    { path: '/' },
    { path: '/contact' },
    ...projects.map((project) => ({
      path: projectHref(project.slug),
      lastModified: project.updatedAt,
    })),
    ...pages.map((page) => ({ path: pageHref(page.slug), lastModified: page.updatedAt })),
    ...(notes.length > 0
      ? [
          {
            path: notesHref,
            lastModified: notes
              .map((note) => note.updatedAt)
              .sort()
              .at(-1),
          },
        ]
      : []),
    ...notes.map((note) => ({ path: noteHref(note.slug), lastModified: note.updatedAt })),
  ]

  const url = (locale: Locale, path: string) => `${serverUrl}${localizedPath(locale, path)}`
  return paths.flatMap(({ path, lastModified }) =>
    served.map((locale) => ({
      url: url(locale, path),
      lastModified,
      alternates: { languages: Object.fromEntries(served.map((code) => [code, url(code, path)])) },
    })),
  )
}
