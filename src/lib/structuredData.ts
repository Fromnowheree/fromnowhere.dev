import { localizedPath } from './metadata'
import { serverUrl } from './serverUrl'
import type { Locale } from '@/i18n/locales'

/**
 * The schema.org nodes the pages describe themselves with (src/components/JsonLd.tsx). The studio
 * is one node, `#studio`, that every page points at: the publisher of the site and its notes, the
 * creator of its projects. Only what the CMS holds goes in; an empty field is left out.
 */

export const STUDIO_ID = `${serverUrl}/#studio`
export const WEBSITE_ID = `${serverUrl}/#website`

export const pageUrl = (locale: Locale, path: string) =>
  `${serverUrl}${localizedPath(locale, path)}`

/** Drops empty values, so no node claims an empty email or an empty list. */
const present = <T extends Record<string, unknown>>(node: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(node).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== '' &&
        !(Array.isArray(value) && value.length === 0),
    ),
  ) as Partial<T>

/** The studio and the site itself, for the home page. */
export const studioGraph = ({
  description,
  email,
  profiles,
  languages,
}: {
  description?: string | null
  email?: string | null
  profiles: string[]
  languages: Locale[]
}) => ({
  '@graph': [
    present({
      '@type': 'Organization',
      '@id': STUDIO_ID,
      name: 'Fromnowhere',
      url: serverUrl,
      logo: `${serverUrl}/icons/icon-512.png`,
      description,
      email,
      sameAs: profiles,
    }),
    {
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      name: 'Fromnowhere',
      url: serverUrl,
      inLanguage: languages,
      publisher: { '@id': STUDIO_ID },
    },
  ],
})

/** A project: a creative work by the studio, which lives at its own address. */
export const projectNode = ({
  locale,
  path,
  name,
  summary,
  address,
  started,
  stack,
}: {
  locale: Locale
  path: string
  name: string
  summary: string
  address?: string | null
  started?: string | null
  stack: string[]
}) =>
  present({
    '@type': 'CreativeWork',
    name,
    description: summary,
    url: address ?? pageUrl(locale, path),
    mainEntityOfPage: pageUrl(locale, path),
    inLanguage: locale,
    dateCreated: started?.slice(0, 10),
    keywords: stack.join(', '),
    creator: { '@type': 'Organization', '@id': STUDIO_ID, name: 'Fromnowhere', url: serverUrl },
  })

/** A note: a dated post by the studio, about one project or the studio itself. */
export const noteNode = ({
  locale,
  path,
  title,
  summary,
  date,
  updatedAt,
  about,
}: {
  locale: Locale
  path: string
  title: string
  summary: string
  date: string
  updatedAt?: string | null
  about?: { name: string; path: string } | null
}) => {
  const studio = { '@type': 'Organization', '@id': STUDIO_ID, name: 'Fromnowhere', url: serverUrl }
  return present({
    '@type': 'BlogPosting',
    headline: title,
    description: summary,
    datePublished: date,
    dateModified: updatedAt,
    inLanguage: locale,
    url: pageUrl(locale, path),
    mainEntityOfPage: pageUrl(locale, path),
    author: studio,
    publisher: studio,
    about: about
      ? { '@type': 'CreativeWork', name: about.name, url: pageUrl(locale, about.path) }
      : undefined,
  })
}
