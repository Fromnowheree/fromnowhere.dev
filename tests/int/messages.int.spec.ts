import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { locales } from '@/i18n/locales'

/**
 * The site's interface text lives in messages/<locale>.json. next-intl does not throw on a missing
 * key: it renders the key's raw path ("form.errors.name") in front of the visitor. So every
 * language must have exactly the keys English has, each one filled, with the same placeholders.
 */
const dir = path.resolve(__dirname, '../../messages')
const load = (locale: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path.join(dir, `${locale}.json`), 'utf8'))

/** Every leaf as [dotted.path, value]. */
const leaves = (tree: Record<string, unknown>, prefix = ''): [string, unknown][] =>
  Object.entries(tree).flatMap(([key, value]) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? leaves(value as Record<string, unknown>, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value] as [string, unknown]],
  )

/** ICU arguments ({name}) and rich-text tags (<privacy>) a translation must keep. */
const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)|<(\w+)>/g)].map((match) => match[1] ?? `<${match[2]}>`).sort()

describe('the message files', () => {
  it('exist for exactly the languages the site is built for', () => {
    const files = readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.replace(/\.json$/, ''))
      .sort()
    expect(files).toEqual([...locales].sort())
  })

  it('have identical key trees in every language', () => {
    const english = leaves(load('en')).map(([key]) => key)
    for (const locale of locales) {
      expect(
        leaves(load(locale)).map(([key]) => key),
        locale,
      ).toEqual(english)
    }
  })

  it('fill every key with text', () => {
    for (const locale of locales) {
      const empty = leaves(load(locale)).filter(
        ([, value]) => typeof value !== 'string' || !value.trim(),
      )
      expect(empty, locale).toEqual([])
    }
  })

  it('keep the same placeholders in every translation', () => {
    const english = new Map(leaves(load('en')))
    for (const locale of locales) {
      for (const [key, value] of leaves(load(locale))) {
        expect(placeholders(String(value)), `${locale} ${key}`).toEqual(
          placeholders(String(english.get(key))),
        )
      }
    }
  })
})
