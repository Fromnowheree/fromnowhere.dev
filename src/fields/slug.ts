import {
  ValidationError,
  type Field,
  type FieldHook,
  type PayloadRequest,
  type TextFieldSingleValidation,
} from 'payload'
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

/** A further check of a slug at save time: true, or the message for the editor. */
export type SlugCheck = (slug: string, req: PayloadRequest) => Promise<string | true>

/** A slug the document already has is not checked again; only a new or changed one is. */
const isNew = (slug: string, previous: unknown) => slug !== previous

/**
 * `extra` for a save that is not a publish, where Payload runs no field validation. A refusal
 * reaches the editor as a validation error on the slug, the same as when publishing.
 */
const checkDraft =
  (extra: SlugCheck): FieldHook =>
  async ({ value, previousValue, data, collection, req }) => {
    if (data?._status === 'published' || typeof value !== 'string' || !value) return value
    if (!isNew(value, previousValue)) return value
    const result = await extra(value, req)
    if (result === true) return value
    throw new ValidationError({
      collection: collection?.slug,
      errors: [{ message: result, path: 'slug' }],
      req,
    })
  }

/**
 * URL slug, generated from `sourceField` when left empty. It is the same in every language
 * (/en/services/x and /hr/services/x), so switching language keeps the visitor on the same page.
 * `reserved` slugs belong to built-in pages, which would always win over the document.
 *
 * `extra` is for what only the database knows (Pages: a short link's word). It runs on a new or
 * changed slug only, so a document that already has its slug can always be edited. It runs on
 * every save, drafts included: as validation (last, on a well-formed slug) when the document is
 * published, and from a `beforeChange` hook when it is saved as a draft, since Payload skips
 * field validation for drafts (and `drafts.validate` would apply every required rule to them).
 */
export const slugField = (
  sourceField = 'title',
  reserved: string[] = [],
  extra?: SlugCheck,
): Field => ({
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
  validate: (async (value, args) => {
    const slug = value ? slugify(value) : ''
    if (reserved.includes(slug))
      return pickLabel(
        args.req?.i18n?.language,
        l(
          `The address "/${slug}" belongs to another page of the site. Choose another.`,
          `Adresa "/${slug}" već pripada drugoj stranici weba. Odaberite drugu.`,
        ),
      )
    const valid = text(value, args)
    if (valid !== true || !extra || !slug || !isNew(slug, args.previousValue)) return valid
    return extra(slug, args.req)
  }) satisfies TextFieldSingleValidation,
  hooks: {
    beforeValidate: [
      ({ value, data }) => {
        if (typeof value === 'string' && value.trim()) return slugify(value)
        const source = data?.[sourceField]
        return typeof source === 'string' ? slugify(source) : value
      },
    ],
    beforeChange: extra ? [checkDraft(extra)] : [],
  },
})
