import type { Note } from '@/payload-types'

/**
 * The notes stay hidden until this many are published (docs/vision.html, "Notes, later"): no
 * /notes, no note pages, no panel on the home page, no list on a project page, no link anywhere.
 */
export const NOTES_OPEN_AT = 3

/** The project a note belongs to, as the notes show it: its line, name and page. */
export type NoteProject = { slug: string; name: string; line: number }

/** A note as the lists show it. `project` is null for a note about the studio itself. */
export type NoteSign = {
  id: number
  slug: string
  title: string
  summary: string
  date: string
  project: NoteProject | null
}

/**
 * A note's project, only while that project is published: a note on a hidden project's line reads
 * as a note about the studio rather than naming something a visitor cannot open.
 */
export const projectOf = (note: Pick<Note, 'project'>): NoteProject | null => {
  const project = note.project
  if (!project || typeof project !== 'object') return null
  if (project._status !== 'published' || !project.slug) return null
  return { slug: project.slug, name: project.name, line: project.line }
}

/** A published note as the lists show it, or null when it has no address yet. */
export const signOf = (
  note: Pick<Note, 'id' | 'slug' | 'title' | 'summary' | 'date' | 'project'>,
): NoteSign | null =>
  note.slug
    ? {
        id: note.id,
        slug: note.slug,
        title: note.title,
        summary: note.summary,
        date: note.date,
        project: projectOf(note),
      }
    : null

/** All of them, or none while fewer than NOTES_OPEN_AT are published. */
export const openNotes = <T>(notes: T[]): T[] => (notes.length >= NOTES_OPEN_AT ? notes : [])

/** The projects that have notes, in line order, each once. */
export const linesOf = (notes: NoteSign[]): NoteProject[] => {
  const bySlug = new Map<string, NoteProject>()
  for (const note of notes) if (note.project) bySlug.set(note.project.slug, note.project)
  return [...bySlug.values()].sort((a, b) => a.line - b.line)
}

/** A note's date as a calendar day: notes are dated by day, kept at noon UTC by the admin. */
export const NOTE_TIME_ZONE = 'UTC'
