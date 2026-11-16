import type { CollectionConfig } from 'payload'

import { richTextRule } from '../fields/richText'
import { seoField } from '../fields/seo'
import { slugField } from '../fields/slug'
import { l } from '../i18n/label'
import { MAX_HEADING_LENGTH, MAX_INTRO_LENGTH } from '../lib/content'
import { RESERVED_PAGE_SLUGS } from '../lib/links'

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
    slugField('title', RESERVED_PAGE_SLUGS),
  ],
}
