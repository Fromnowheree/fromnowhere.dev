import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { NOTES, PAGES, PROJECTS } from '@/seed'
import { CAPABILITIES, SERVICES } from '@/seed/offer'

/**
 * The studio's voice (AGENTS.md, "Voice"): it speaks as Fromnowhere or "the studio", never as "I"
 * or "we", and never says how many people it is. Checked over everything a visitor reads that the
 * repository writes: the interface text and the seed.
 */

/** Every string in a value, however deep. */
const strings = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : value && typeof value === 'object'
      ? Object.values(value).flatMap(strings)
      : []

const messages = (locale: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path.resolve(__dirname, `../../messages/${locale}.json`), 'utf8'))

/** The visitor's own words, which may say "I": the proof-of-work label and the consent line. */
const withoutVisitorsWords = (tree: Record<string, unknown>) => {
  const form = tree.form as Record<string, unknown>
  const proof = form.proof as Record<string, unknown>
  return { ...tree, form: { ...form, consent: undefined, proof: { ...proof, label: undefined } } }
}

const seeded = (locale: 'en' | 'hr') =>
  strings(
    [PAGES, PROJECTS, NOTES, SERVICES, CAPABILITIES].map((list) => list.map((d) => d[locale])),
  )

const ENGLISH = /\b(I|I’m|I’ll|I’ve|me|my|myself|we|we’re|us|our)\b|one[- ]person|solo|freelanc/
// Croatian drops the pronoun, so the first person shows in the verb. Only the forms that cannot
// be anything else are listed ("sam" is also "itself"), with letter-aware word edges: JavaScript's
// \b takes č and š for edges.
const CROATIAN =
  /(?<!\p{L})(ću|ćemo|smo|jesam|nisam|moj|moja|moje|mojem|naš|naša|naše|meni|mene|šaljem|provjeravam|izrađujem|odgovaram)(?!\p{L})|jednog čovjeka|jedna osoba|samostaln/iu

describe('the studio’s voice', () => {
  it('is never the first person, and never a headcount, in English', () => {
    const text = [...strings(withoutVisitorsWords(messages('en'))), ...seeded('en')]
    expect(text.filter((line) => ENGLISH.test(line))).toEqual([])
  })

  it('nor in Croatian', () => {
    const text = [...strings(withoutVisitorsWords(messages('hr'))), ...seeded('hr')]
    expect(text.filter((line) => CROATIAN.test(line))).toEqual([])
  })
})
