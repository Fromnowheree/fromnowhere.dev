import type { Field, TextFieldSingleValidation } from 'payload'
import { text } from 'payload/shared'

import { l, pickLabel } from '../i18n/label'
import { MAX_SLUG_LENGTH } from '../lib/content'

const charMap: Record<string, string> = { č: 'c', ć: 'c', š: 's', ž: 'z', đ: 'd' }

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[čćšžđ]/g, (char) => charMap[char] ?? char)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export { isSlug } from '../lib/links'

/**
 * URL slug, generated from `sourceField` when left empty. It is the same in every language
 * (/en/services/x and /hr/services/x), so switching language keeps the visitor on the same page.
 * `reserved` slugs belong to built-in pages, which would always win over the document.
 */
export const slugField = (sourceField = 'title', reserved: string[] = []): Field => ({
  name: 'slug',
  type: 'text',
  label: l('Address (slug)', 'Adresa (slug)'),
  index: true,
  unique: true,
  maxLength: MAX_SLUG_LENGTH,
  admin: {
    position: 'sidebar',
    description: l(
      'Part of the web address, e.g. "physiotherapy". The same in every language. Leave empty to generate it.',
      'Dio web adrese, npr. "fizioterapija". Ista je na svim jezicima. Ostavite prazno za automatsko generiranje.',
    ),
  },
  validate: ((value, args) => {
    const slug = value ? slugify(value) : ''
    if (reserved.includes(slug))
      return pickLabel(
        args.req?.i18n?.language,
        l(
          `The address "/${slug}" belongs to another page of the site. Choose another.`,
          `Adresa "/${slug}" već pripada drugoj stranici weba. Odaberite drugu.`,
        ),
      )
    return text(value, args)
  }) satisfies TextFieldSingleValidation,
  hooks: {
    beforeValidate: [
      ({ value, data }) => {
        if (typeof value === 'string' && value.trim()) return slugify(value)
        const source = data?.[sourceField]
        return typeof source === 'string' ? slugify(source) : value
      },
    ],
  },
})
