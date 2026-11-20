import type { CollectionConfig } from 'payload'

import { richTextRule } from '../fields/richText'
import { slugField } from '../fields/slug'
import { signedIn } from '../access'
import { l } from '../i18n/label'

/**
 * What the studio can be hired for: one section of /<language>/services each and one card on the
 * home page, lettered A, B, C in their order. A service names the projects that prove it; only
 * the published ones show. Nothing about services is public until one is published: no page, no
 * band on the home page, no link in the header.
 */
export const Services: CollectionConfig = {
  slug: 'services',
  labels: { singular: l('Service', 'Usluga'), plural: l('Services', 'Usluge') },
  admin: {
    group: l('Content', 'Sadržaj'),
    useAsTitle: 'name',
    defaultColumns: ['order', 'name', '_status', 'updatedAt'],
    description: l(
      'What the studio can be hired for. Each published service is a card on the home page and a section of the Services page.',
      'Za što se studio može angažirati. Svaka objavljena usluga je kartica na početnoj stranici i odjeljak stranice Usluge.',
    ),
  },
  defaultSort: 'order',
  // The editor's, over the API: the site reads through the Local API (src/lib/payload.ts), which
  // names `_status: published` itself, so a visitor has nothing to read here (tests/e2e/api).
  access: { read: signedIn },
  versions: { drafts: true, maxPerDoc: 25 },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: l('Name', 'Naziv'),
      required: true,
      localized: true,
      maxLength: 80,
      admin: {
        description: l('E.g. "Websites with an editor".', 'Npr. "Web stranice s uređivačem".'),
      },
    },
    {
      name: 'summary',
      type: 'textarea',
      label: l('In one sentence', 'U jednoj rečenici'),
      required: true,
      localized: true,
      maxLength: 300,
      admin: {
        description: l(
          'What a client gets. Shown on the card and under the name.',
          'Što klijent dobiva. Prikazuje se na kartici i ispod naziva.',
        ),
      },
    },
    {
      name: 'text',
      type: 'richText',
      label: l('What is in it', 'Što uključuje'),
      localized: true,
      validate: richTextRule,
      admin: {
        description: l(
          'A short list reads best. Shown on the Services page.',
          'Najbolje se čita kratak popis. Prikazuje se na stranici Usluge.',
        ),
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'order',
          type: 'number',
          label: l('Order', 'Redoslijed'),
          required: true,
          min: 1,
          max: 26,
          defaultValue: 1,
          admin: {
            width: '33%',
            step: 1,
            description: l('The first is service A, the second B.', 'Prva je usluga A, druga B.'),
          },
        },
        {
          name: 'projects',
          type: 'relationship',
          relationTo: 'projects',
          hasMany: true,
          maxRows: 12,
          label: l('Proven by', 'Dokazuju je'),
          admin: {
            width: '67%',
            description: l(
              'The projects where this was done. Only published ones show.',
              'Projekti u kojima je to napravljeno. Prikazuju se samo objavljeni.',
            ),
          },
        },
      ],
    },
    slugField('name'),
  ],
}
