import type { CollectionConfig } from 'payload'

import { richTextRule } from '../fields/richText'
import { seoField } from '../fields/seo'
import { slugField } from '../fields/slug'
import { l } from '../i18n/label'
import { MAX_HEADING_LENGTH, MAX_INTRO_LENGTH } from '../lib/content'

/**
 * Short, dated notes on what is being built (docs/vision.html, "Notes, later"), at
 * /<language>/notes and /<language>/notes/<slug>, with the newest on the home page and each
 * project's own under its page. A note belongs to one project's line, or to none (the studio
 * itself). Nothing about them is public until at least three are published (src/lib/notes.ts).
 */
export const Notes: CollectionConfig = {
  slug: 'notes',
  labels: { singular: l('Note', 'Bilješka'), plural: l('Notes', 'Bilješke') },
  admin: {
    group: l('Content', 'Sadržaj'),
    useAsTitle: 'title',
    defaultColumns: ['title', 'date', 'project', '_status'],
    description: l(
      'Short, dated notes on what you are building. They appear on the site once at least three are published.',
      'Kratke bilješke s datumom o onome što izrađujete. Na webu se pojavljuju kad su objavljene barem tri.',
    ),
  },
  defaultSort: '-date',
  access: {
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
      type: 'row',
      fields: [
        {
          name: 'date',
          type: 'date',
          label: l('Date', 'Datum'),
          required: true,
          index: true,
          // Today at noon UTC: a day stays the same day in every time zone the site is read in.
          defaultValue: () => {
            const today = new Date()
            today.setUTCHours(12, 0, 0, 0)
            return today.toISOString()
          },
          admin: {
            width: '50%',
            date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' },
            description: l('The newest is shown first.', 'Najnovija se prikazuje prva.'),
          },
        },
        {
          name: 'project',
          type: 'relationship',
          relationTo: 'projects',
          label: l('Project', 'Projekt'),
          admin: {
            width: '50%',
            description: l(
              'Whose line it belongs to. Empty for a note about the studio itself.',
              'Na čijoj je liniji. Prazno za bilješku o samom studiju.',
            ),
          },
        },
      ],
    },
    {
      name: 'summary',
      type: 'textarea',
      label: l('In one or two sentences', 'U jednoj ili dvije rečenice'),
      required: true,
      localized: true,
      maxLength: MAX_INTRO_LENGTH,
      admin: {
        description: l(
          'Shown in the lists and under the title.',
          'Prikazuje se u popisima i ispod naslova.',
        ),
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
    slugField('title'),
  ],
}
