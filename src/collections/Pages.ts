import type { CollectionConfig } from 'payload'

import { richTextRule } from '../fields/richText'
import { seoField } from '../fields/seo'
import { slugField, type SlugCheck } from '../fields/slug'
import { l, pickLabel } from '../i18n/label'
import { MAX_HEADING_LENGTH, MAX_INTRO_LENGTH } from '../lib/content'
import { RESERVED_PAGE_SLUGS } from '../lib/links'

/**
 * A page's address without a language (fromnowhere.dev/about) must lead to the page, so its slug
 * may not be a short link's word (Content → Short links). Checked when a page is saved, as a draft
 * or published, but only for a new or changed slug (src/fields/slug.ts): a short link written with
 * a page's word before this rule existed does not lock the page against edits. The short link
 * refuses a page's slug too (src/collections/ShortLinks.ts), and pick-language prefers the page
 * regardless.
 */
const notAShortLink: SlugCheck = async (slug, req) => {
  const { totalDocs } = await req.payload.count({
    collection: 'short-links',
    where: { alias: { equals: slug } },
    req,
  })
  if (totalDocs === 0) return true
  return pickLabel(
    req.i18n?.language,
    l(
      `"/${slug}" is a short link. Choose another address, or remove the short link first.`,
      `"/${slug}" je kratka poveznica. Odaberite drugu adresu ili najprije uklonite kratku poveznicu.`,
    ),
  )
}

/**
 * Plain text pages: About, the privacy policy and anything like them, served at
 * /<language>/<slug> by src/app/(frontend)/[locale]/(site)/[slug]/page.tsx. The home page,
 * projects and contact have routes of their own. A page is public only once it is published.
 */
export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: l('Page', 'Stranica'), plural: l('Pages', 'Stranice') },
  admin: {
    group: l('Content', 'Sadržaj'),
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status', 'updatedAt'],
    description: l(
      'Text pages such as About and the privacy policy. The home page, projects and contact are built in.',
      'Tekstualne stranice poput O meni i pravila privatnosti. Početna, projekti i kontakt su ugrađeni.',
    ),
  },
  access: {
    // Visitors (and the REST API without a session) see published pages only.
    read: ({ req }) => (req.user ? true : { _status: { equals: 'published' } }),
  },
  versions: { drafts: true, maxPerDoc: 25 },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: l('Title', 'Naslov'),
      required: true,
      localized: true,
      maxLength: MAX_HEADING_LENGTH,
    },
    {
      name: 'lead',
      type: 'textarea',
      label: l('Lead sentence', 'Uvodna rečenica'),
      localized: true,
      maxLength: MAX_INTRO_LENGTH,
      admin: {
        description: l('Shown under the title.', 'Prikazuje se ispod naslova.'),
      },
    },
    {
      name: 'content',
      type: 'richText',
      label: l('Text', 'Tekst'),
      localized: true,
      validate: richTextRule,
    },
    seoField,
    slugField('title', RESERVED_PAGE_SLUGS, notAShortLink),
  ],
}
