import config from '@payload-config'
import { getPayload } from 'payload'
import { cache } from 'react'

import { defaultLocale, locales, type Locale } from '@/i18n/locales'
import type { Project } from '@/payload-types'
import { isSlug, projectHref, type PublishedIndex } from './links'
import { withService, type AddressCheck, type LiveProject } from './status'

export const getPayloadClient = () => getPayload({ config })

// React `cache` dedupes these within a single request (layout + page + metadata), per argument.
// The site reads through the Local API, which skips access control, so every query of pages and
// projects names `_status: published` itself: a draft is never shown to a visitor.

const published = { _status: { equals: 'published' } } as const

/** The studio's settings in `locale`; fields left empty in that language fall back to English. */
export const getStudio = cache(async (locale: Locale) =>
  (await getPayloadClient()).findGlobal({ slug: 'studio', depth: 0, locale }),
)

/**
 * The languages the site serves, the main one (English) first. Both, always: unlike the NMT-PublicWeb
 * template this came from, there is no setting to switch one off.
 */
export const getServedLocales = async (): Promise<Locale[]> => [
  defaultLocale,
  ...locales.filter((locale) => locale !== defaultLocale),
]

/** The main language: where a visitor lands when nothing says which they want. */
export const getMainLanguage = async (): Promise<Locale> => defaultLocale

/**
 * What the status check last heard from each address (src/jobs/checkStatus.ts), by address. An
 * address it has not checked is simply absent; a failure to read them leaves the board as the
 * editor set it rather than breaking the page.
 */
export const getStatusChecks = cache(async (): Promise<Map<string, AddressCheck>> => {
  try {
    const { docs } = await (
      await getPayloadClient()
    ).find({
      collection: 'status-checks',
      depth: 0,
      limit: 1000,
      pagination: false,
      select: { url: true, failures: true, checkedAt: true },
    })
    return new Map(
      docs.map((doc) => [doc.url, { failures: doc.failures ?? 0, checkedAt: doc.checkedAt }]),
    )
  } catch (error) {
    console.error('The status checks could not be read; the board shows the set statuses.', error)
    return new Map()
  }
})

/** Every published project, in line order, with its live status (src/lib/status.ts). */
export const getProjects = cache(async (locale: Locale): Promise<LiveProject[]> => {
  const [{ docs }, checks] = await Promise.all([
    (await getPayloadClient()).find({
      collection: 'projects',
      where: published,
      sort: 'line',
      depth: 1,
      limit: 99,
      locale,
    }),
    getStatusChecks(),
  ])
  return docs.map((project) => withService(project, checks))
})

/** One published project with its live status, or null. */
export const getProject = cache(
  async (slug: string, locale: Locale): Promise<LiveProject | null> => {
    if (!isSlug(slug)) return null
    const [{ docs }, checks] = await Promise.all([
      (await getPayloadClient()).find({
        collection: 'projects',
        where: { and: [{ slug: { equals: slug } }, published] },
        depth: 2,
        limit: 1,
        locale,
      }),
      getStatusChecks(),
    ])
    return docs[0] ? withService(docs[0], checks) : null
  },
)

/** One published page, or null. */
export const getPage = cache(async (slug: string, locale: Locale) => {
  // A malformed segment (e.g. a NUL byte, which Postgres rejects) is simply not a page.
  if (!isSlug(slug)) return null
  const { docs } = await (
    await getPayloadClient()
  ).find({
    collection: 'pages',
    where: { and: [{ slug: { equals: slug } }, published] },
    depth: 2,
    limit: 1,
    locale,
  })
  return docs[0] ?? null
})

/** Every published page and project by slug, with when it last changed (not localised). */
export const getPublishedSummaries = cache(async () => {
  const payload = await getPayloadClient()
  const [pages, projects] = await Promise.all([
    payload.find({
      collection: 'pages',
      where: published,
      depth: 0,
      limit: 500,
      select: { slug: true, updatedAt: true },
    }),
    payload.find({
      collection: 'projects',
      where: published,
      depth: 0,
      limit: 99,
      select: { slug: true, updatedAt: true },
    }),
  ])
  const pick = (docs: { slug?: string | null; updatedAt: string }[]) =>
    docs.flatMap((doc) => (doc.slug ? [{ slug: doc.slug, updatedAt: doc.updatedAt }] : []))
  return { pages: pick(pages.docs), projects: pick(projects.docs) }
})

/** What a site path may link to: published pages and published projects. */
export const getPublishedIndex = cache(async (): Promise<PublishedIndex> => {
  const { pages, projects } = await getPublishedSummaries()
  return {
    pages: new Set(pages.map((page) => page.slug)),
    projects: new Set(projects.map((project) => project.slug)),
  }
})

/** Where a project's line ends: its first address, or its page here while it has none. */
export const destinationOf = (
  project: Pick<Project, 'addresses' | 'slug'>,
): { href: string; external: boolean } => {
  const first = project.addresses?.[0]?.url
  return first
    ? { href: first, external: true }
    : { href: projectHref(project.slug ?? ''), external: false }
}

/** A short link as the home page's ticker shows it: the word, and where it leads. */
export type ShortLinkSign = {
  alias: string
  /** An absolute https address, or a site path without its language (a project's page here). */
  href: string
  external: boolean
}

/**
 * Every short link that leads somewhere public, for the ticker: in the line order of the projects
 * they name, then the ones with an address of their own, by word. Short links have no drafts; the
 * projects they name do, so a link to a project that is not published is left out, exactly as
 * `resolveShortLink` would refuse it.
 */
export const getShortLinks = cache(async (): Promise<ShortLinkSign[]> => {
  const payload = await getPayloadClient()
  const { docs: links } = await payload.find({
    collection: 'short-links',
    depth: 0,
    limit: 100,
    sort: 'alias',
    select: { alias: true, project: true, url: true },
  })
  const ids = links.flatMap((link) => {
    const id = typeof link.project === 'object' ? link.project?.id : link.project
    return !link.url && id ? [id] : []
  })
  const { docs: projects } = ids.length
    ? await payload.find({
        collection: 'projects',
        where: { and: [{ id: { in: ids } }, published] },
        depth: 0,
        limit: 100,
        select: { slug: true, addresses: true, line: true },
      })
    : { docs: [] }
  const byId = new Map(projects.map((project) => [project.id, project]))

  return links
    .flatMap((link) => {
      if (link.url) return [{ alias: link.alias, href: link.url, external: true, order: Infinity }]
      const id = typeof link.project === 'object' ? link.project?.id : link.project
      const project = id ? byId.get(id) : undefined
      if (!project) return []
      return [{ alias: link.alias, ...destinationOf(project), order: project.line }]
    })
    .sort((a, b) => a.order - b.order || a.alias.localeCompare(b.alias))
    .map(({ alias, href, external }) => ({ alias, href, external }))
})

/**
 * Where a short link (fromnowhere.dev/<word>) leads, or null when there is no such word or what
 * it names is not public. An address written on the link wins; otherwise the project's own
 * destination. The result is absolute (https://…) or a site path without its language.
 */
export const resolveShortLink = async (alias: string): Promise<string | null> => {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'short-links',
    where: { alias: { equals: alias } },
    depth: 0,
    limit: 1,
  })
  const link = docs[0]
  if (!link) return null
  if (link.url) return link.url
  const id = typeof link.project === 'object' ? link.project?.id : link.project
  if (!id) return null
  const { docs: projects } = await payload.find({
    collection: 'projects',
    where: { and: [{ id: { equals: id } }, published] },
    depth: 0,
    limit: 1,
    select: { slug: true, addresses: true },
  })
  return projects[0] ? destinationOf(projects[0]).href : null
}
