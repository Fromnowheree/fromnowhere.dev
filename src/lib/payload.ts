import config from '@payload-config'
import { getPayload } from 'payload'
import { cache } from 'react'

import { defaultLocale, locales, type Locale } from '@/i18n/locales'
import { CAPABILITY_AREAS, type CapabilityArea } from '@/collections/Capabilities'
import type { Capability, Project, Service } from '@/payload-types'
import { isSlug, projectHref, type PublishedIndex } from './links'
import { openNotes, signOf, type NoteSign } from './notes'
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

/**
 * Every published note, newest first, as the lists show them; none at all while fewer than three
 * are published (src/lib/notes.ts). A note's project comes with it only while it is published.
 */
export const getNotes = cache(async (locale: Locale): Promise<NoteSign[]> => {
  const { docs } = await (
    await getPayloadClient()
  ).find({
    collection: 'notes',
    where: published,
    sort: ['-date', '-createdAt'],
    depth: 1,
    limit: 1000,
    pagination: false,
    locale,
    select: { title: true, slug: true, date: true, summary: true, project: true },
    populate: { projects: { slug: true, name: true, line: true, _status: true } },
  })
  return openNotes(docs.flatMap((note) => signOf(note) ?? []))
})

/** One published note with its text, or null (also while the notes are closed). */
export const getNote = cache(async (slug: string, locale: Locale) => {
  if (!isSlug(slug)) return null
  const sign = (await getNotes(locale)).find((note) => note.slug === slug)
  if (!sign) return null
  const { docs } = await (
    await getPayloadClient()
  ).find({
    collection: 'notes',
    where: { and: [{ id: { equals: sign.id } }, published] },
    depth: 2,
    limit: 1,
    locale,
  })
  return docs[0] ? { ...docs[0], project: sign.project } : null
})

/** A project as a service or a capability names it: its line, name and page. */
export type ProofProject = { slug: string; name: string; line: number }

/** The published ones of the projects a document names, in line order. */
const proofOf = (projects: (number | Project)[] | null | undefined): ProofProject[] =>
  (projects ?? [])
    .flatMap((project) =>
      typeof project === 'object' && project._status === 'published' && project.slug
        ? [{ slug: project.slug, name: project.name, line: project.line }]
        : [],
    )
    .sort((a, b) => a.line - b.line)

const proofSelect = { projects: { slug: true, name: true, line: true, _status: true } } as const

/** A service as the site shows it: lettered by its place, with the published projects behind it. */
export type ServiceSign = Pick<Service, 'id' | 'name' | 'summary' | 'text' | 'updatedAt'> & {
  slug: string
  /** A, B, C… by its place among the published services. */
  letter: string
  proof: ProofProject[]
}

/** Every published service, in order. A draft project it names is left out of its proof. */
export const getServices = cache(async (locale: Locale): Promise<ServiceSign[]> => {
  const { docs } = await (
    await getPayloadClient()
  ).find({
    collection: 'services',
    where: published,
    sort: ['order', 'createdAt'],
    depth: 1,
    limit: 26,
    locale,
    populate: proofSelect,
  })
  return docs
    .filter((service) => service.slug)
    .map((service, i) => ({
      id: service.id,
      name: service.name,
      summary: service.summary,
      text: service.text,
      updatedAt: service.updatedAt,
      slug: service.slug!,
      letter: String.fromCharCode(65 + i),
      proof: proofOf(service.projects),
    }))
})

/** A capability as the site shows it, with where it is in service. */
export type CapabilitySign = Pick<Capability, 'id' | 'title' | 'text' | 'area'> & {
  onThisSite: boolean
  proof: ProofProject[]
}

/** Every published capability, by area in the page's order, each area's in their own order. */
export const getCapabilities = cache(
  async (locale: Locale): Promise<{ area: CapabilityArea; items: CapabilitySign[] }[]> => {
    const { docs } = await (
      await getPayloadClient()
    ).find({
      collection: 'capabilities',
      where: published,
      sort: ['order', 'createdAt'],
      depth: 1,
      limit: 200,
      pagination: false,
      locale,
      populate: proofSelect,
    })
    return CAPABILITY_AREAS.map((area) => ({
      area,
      items: docs
        .filter((capability) => capability.area === area)
        .map((capability) => ({
          id: capability.id,
          title: capability.title,
          text: capability.text,
          area: capability.area,
          onThisSite: Boolean(capability.onThisSite),
          proof: proofOf(capability.projects),
        })),
    })).filter((group) => group.items.length > 0)
  },
)

/**
 * Every published page and project by slug, with when it last changed (not localised), and when
 * the services and the capabilities last changed (null while none is published).
 */
export const getPublishedSummaries = cache(async () => {
  const payload = await getPayloadClient()
  const latest = async (collection: 'services' | 'capabilities') => {
    const { docs } = await payload.find({
      collection,
      where: published,
      depth: 0,
      limit: 1,
      sort: '-updatedAt',
      select: { updatedAt: true },
    })
    return docs[0]?.updatedAt ?? null
  }
  const [pages, projects, notes, services, capabilities] = await Promise.all([
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
    payload.find({
      collection: 'notes',
      where: published,
      depth: 0,
      limit: 1000,
      pagination: false,
      select: { slug: true, updatedAt: true },
    }),
    latest('services'),
    latest('capabilities'),
  ])
  const pick = (docs: { slug?: string | null; updatedAt: string }[]) =>
    docs.flatMap((doc) => (doc.slug ? [{ slug: doc.slug, updatedAt: doc.updatedAt }] : []))
  return {
    pages: pick(pages.docs),
    projects: pick(projects.docs),
    notes: openNotes(pick(notes.docs)),
    services,
    capabilities,
  }
})

/**
 * What a site path may link to: published pages, projects and (while they are open) notes, and
 * the services and capabilities pages while one of each is published.
 */
export const getPublishedIndex = cache(async (): Promise<PublishedIndex> => {
  const { pages, projects, notes, services, capabilities } = await getPublishedSummaries()
  return {
    services: services !== null,
    capabilities: capabilities !== null,
    pages: new Set(pages.map((page) => page.slug)),
    projects: new Set(projects.map((project) => project.slug)),
    notes: new Set(notes.map((note) => note.slug)),
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
