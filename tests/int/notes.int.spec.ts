import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { linkTarget, RESERVED_PAGE_SLUGS, resolveLink } from '@/lib/links'
import { linesOf, NOTES_OPEN_AT, openNotes, projectOf, type NoteSign } from '@/lib/notes'
import { getNote, getNotes, getPublishedIndex, getPublishedSummaries } from '@/lib/payload'
import { isShortAlias } from '@/lib/shortLinks'
import config from '@/payload.config'
import { NOTES, seed } from '@/seed'
import { richText } from '@/seed/lexical'

/**
 * The notes (docs/vision.html, "Notes, later"): hidden everywhere until three are published,
 * newest first, each on its project's line while that project is published.
 */

let payload: Payload
let giogio: number
let draftProject: number

const sign = (slug: string, project: NoteSign['project'] = null): NoteSign => ({
  id: 1,
  slug,
  title: slug,
  summary: slug,
  date: '2026-11-16T12:00:00.000Z',
  project,
})

const note = (
  slug: string,
  date: string,
  { project, status = 'published' }: { project?: number; status?: 'published' | 'draft' } = {},
) =>
  payload.create({
    collection: 'notes',
    draft: status === 'draft',
    data: {
      _status: status,
      slug,
      title: `Title of ${slug}`,
      summary: `Summary of ${slug}`,
      date,
      project,
      content: richText([`The text of ${slug}.`]),
    },
  })

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await seed(payload)
  // This file decides how many notes there are: the seed's two (if they were seeded) go first.
  await payload.delete({ collection: 'notes', where: { id: { exists: true } } })
  await payload.delete({ collection: 'projects', where: { slug: { equals: 'notes-draft' } } })
  const { docs } = await payload.find({
    collection: 'projects',
    where: { slug: { equals: 'giogio' } },
    limit: 1,
  })
  giogio = docs[0]!.id
  draftProject = (
    await payload.create({
      collection: 'projects',
      draft: true,
      data: {
        _status: 'draft',
        name: 'A hidden project',
        slug: 'notes-draft',
        summary: 'Not ready to show.',
        line: 91,
        status: 'planned',
        kind: 'product',
      },
    })
  ).id
})

afterAll(async () => {
  await payload.delete({ collection: 'notes', where: { id: { exists: true } } })
  await payload.delete({ collection: 'projects', where: { slug: { equals: 'notes-draft' } } })
})

describe('the rules', () => {
  it('open at three', () => {
    expect(NOTES_OPEN_AT).toBe(3)
    expect(openNotes([1, 2])).toEqual([])
    expect(openNotes([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('name a project only while it is published', () => {
    expect(projectOf({ project: null })).toBeNull()
    expect(projectOf({ project: 4 })).toBeNull()
    const project = { _status: 'published', slug: 'giogio', name: 'Giogio', line: 2 } as never
    expect(projectOf({ project })).toEqual({ slug: 'giogio', name: 'Giogio', line: 2 })
    expect(projectOf({ project: { ...(project as object), _status: 'draft' } as never })).toBeNull()
  })

  it('list each line with notes once, in line order', () => {
    const locals = { slug: 'locals', name: 'Locals', line: 1 }
    const gati = { slug: 'gati', name: 'Gati', line: 4 }
    const lines = linesOf([sign('a', gati), sign('b'), sign('c', locals), sign('d', gati)])
    expect(lines).toEqual([locals, gati])
  })

  it('keep /notes for themselves', () => {
    expect(RESERVED_PAGE_SLUGS).toContain('notes')
    expect(isShortAlias('notes')).toBe(false)
    expect(linkTarget('/notes')).toEqual({ kind: 'notes' })
    expect(linkTarget('/notes/')).toEqual({ kind: 'notes' })
    expect(linkTarget('/notes/a-note')).toEqual({ kind: 'note', slug: 'a-note' })
    expect(linkTarget('/notes/a/b')).toBeNull()
    expect(linkTarget('/notes/Not_A_Slug')).toBeNull()
  })

  it('let a link to them render only while they are open', () => {
    const closed = {
      pages: new Set<string>(),
      projects: new Set<string>(),
      notes: new Set<string>(),
    }
    const open = { ...closed, notes: new Set(['a-note']) }
    expect(resolveLink('/notes', closed)).toBeNull()
    expect(resolveLink('/notes/a-note', closed)).toBeNull()
    expect(resolveLink('/notes', open)).toBe('/notes')
    expect(resolveLink('/notes/a-note', open)).toBe('/notes/a-note')
    expect(resolveLink('/notes/another', open)).toBeNull()
  })

  it('are refused as a page’s address', async () => {
    await expect(
      payload.create({
        collection: 'pages',
        data: { title: 'Notes', slug: 'notes', _status: 'published' },
      }),
    ).rejects.toThrow()
  })
})

describe('the seed', () => {
  it('writes two true notes about the studio in both languages, one short of opening', () => {
    expect(NOTES).toHaveLength(NOTES_OPEN_AT - 1)
    for (const seeded of NOTES) {
      expect(seeded.en.title).toBeTruthy()
      expect(seeded.hr.title).toBeTruthy()
      expect(seeded.hr.summary).not.toBe(seeded.en.summary)
    }
  })
})

describe('the published notes', () => {
  it('are hidden while fewer than three are published, drafts not counting', async () => {
    await note('notes-one', '2026-11-10T12:00:00.000Z', { project: giogio })
    await note('notes-two', '2026-10-01T12:00:00.000Z')
    await note('notes-draft-note', '2026-11-17T12:00:00.000Z', { status: 'draft' })
    expect(await getNotes('en')).toEqual([])
    expect(await getNote('notes-one', 'en')).toBeNull()
    expect((await getPublishedIndex()).notes.size).toBe(0)
    expect((await getPublishedSummaries()).notes).toEqual([])
  })

  it('open at the third, the newest first', async () => {
    await note('notes-three', '2026-11-12T12:00:00.000Z', { project: draftProject })
    const notes = await getNotes('en')
    expect(notes.map((n) => n.slug)).toEqual(['notes-three', 'notes-one', 'notes-two'])
    const index = await getPublishedIndex()
    expect([...index.notes].sort()).toEqual(['notes-one', 'notes-three', 'notes-two'])
    expect(resolveLink('/notes', index)).toBe('/notes')
    expect(resolveLink('/notes/notes-draft-note', index)).toBeNull()
  })

  it('carry their project only while it is published', async () => {
    const notes = await getNotes('en')
    const byId = Object.fromEntries(notes.map((n) => [n.slug, n.project]))
    expect(byId['notes-one']).toEqual({ slug: 'giogio', name: 'Giogio', line: 2 })
    // On a hidden project's line: it reads as a note about the studio.
    expect(byId['notes-three']).toBeNull()
    expect(byId['notes-two']).toBeNull()
  })

  it('give one note with its text, and none for a draft or an unknown address', async () => {
    const one = await getNote('notes-one', 'en')
    expect(one?.title).toBe('Title of notes-one')
    expect(JSON.stringify(one?.content)).toContain('The text of notes-one.')
    expect(one?.project).toEqual({ slug: 'giogio', name: 'Giogio', line: 2 })
    expect(await getNote('notes-draft-note', 'en')).toBeNull()
    expect(await getNote('nothing-here', 'en')).toBeNull()
    expect(await getNote('../etc', 'en')).toBeNull()
  })

  it('fall back to English where a Croatian field is empty', async () => {
    const notes = await getNotes('hr')
    expect(notes.find((n) => n.slug === 'notes-one')?.title).toBe('Title of notes-one')
  })

  it('are read-only to visitors through the API: drafts stay out', async () => {
    const { docs } = await payload.find({
      collection: 'notes',
      overrideAccess: false,
      depth: 0,
      limit: 100,
    })
    expect(docs.map((n) => n.slug).sort()).toEqual(['notes-one', 'notes-three', 'notes-two'])
  })
})
