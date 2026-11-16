import type { CollectionConfig } from 'payload'

import { httpsRule } from '../fields/link'
import { richTextRule } from '../fields/richText'
import { rowLabel } from '../fields/rowLabel'
import { seoField } from '../fields/seo'
import { slugField } from '../fields/slug'
import { l } from '../i18n/label'
import { MAX_INTRO_LENGTH, MAX_LABEL_LENGTH, MAX_LINK_LENGTH } from '../lib/content'

/** How a project's line is drawn: solid while it runs, dashed while it is being built. */
export const PROJECT_STATUSES = ['running', 'building', 'planned', 'paused'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const PROJECT_KINDS = ['product', 'community', 'music', 'client'] as const

/**
 * One line on the route map and one row on the departures board, and its own page at
 * /<language>/projects/<slug>. Only published projects are on the site: a project kept as a
 * draft (a prototype, something not ready to show) is invisible until it is published.
 */
export const Projects: CollectionConfig = {
  slug: 'projects',
  labels: { singular: l('Project', 'Projekt'), plural: l('Projects', 'Projekti') },
  admin: {
    group: l('Content', 'Sadržaj'),
    useAsTitle: 'name',
    defaultColumns: ['line', 'name', 'status', '_status', 'updatedAt'],
    description: l(
      'Each published project is a line on the home page’s map, a row on the board and a page of its own. Keep a project as a draft to hide it.',
      'Svaki objavljeni projekt je linija na karti početne stranice, red na ploči i zasebna stranica. Projekt spremljen kao skica je skriven.',
    ),
  },
  defaultSort: 'line',
  access: {
    read: ({ req }) => (req.user ? true : { _status: { equals: 'published' } }),
  },
  versions: { drafts: true, maxPerDoc: 25 },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: l('Name', 'Naziv'),
      required: true,
      maxLength: 80,
      admin: {
        description: l(
          'The project’s own name, the same in every language.',
          'Naziv projekta, isti na svim jezicima.',
        ),
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
          'What it is, for the board and the top of its page. E.g. "An artist’s site, a producer’s site and an album you can play."',
          'Što je to, za ploču i vrh njegove stranice. Npr. "Stranica izvođača, stranica producenta i album koji se može igrati."',
        ),
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'line',
          type: 'number',
          label: l('Line number', 'Broj linije'),
          required: true,
          unique: true,
          min: 1,
          max: 99,
          admin: {
            width: '33%',
            step: 1,
            description: l(
              'Its place on the map and the board, top to bottom.',
              'Mjesto na karti i ploči, odozgo prema dolje.',
            ),
          },
        },
        {
          name: 'status',
          type: 'select',
          // Its own enum name: Payload names a select's enum after the field, and drafts already
          // own `enum_projects_status` (for `_status`), so the default would collide.
          enumName: 'enum_projects_line_status',
          label: l('Status', 'Status'),
          required: true,
          defaultValue: 'building',
          options: [
            { value: 'running', label: l('Running', 'Radi') },
            { value: 'building', label: l('Building', 'U izradi') },
            { value: 'planned', label: l('Planned', 'Planirano') },
            { value: 'paused', label: l('Paused', 'Pauzirano') },
          ],
          admin: {
            width: '33%',
            description: l(
              'Anything but Running draws a dashed line.',
              'Sve osim "Radi" crta isprekidanu liniju.',
            ),
          },
        },
        {
          name: 'kind',
          type: 'select',
          label: l('Kind', 'Vrsta'),
          required: true,
          defaultValue: 'product',
          options: [
            { value: 'product', label: l('Product', 'Proizvod') },
            { value: 'community', label: l('Community', 'Zajednica') },
            { value: 'music', label: l('Music', 'Glazba') },
            { value: 'client', label: l('Client work', 'Rad za klijenta') },
          ],
          admin: { width: '33%' },
        },
      ],
    },
    {
      name: 'addresses',
      type: 'array',
      label: l('Addresses', 'Adrese'),
      labels: { singular: l('Address', 'Adresa'), plural: l('Addresses', 'Adrese') },
      maxRows: 6,
      admin: {
        description: l(
          'Where the project lives. The first is where its line ends; the others are stops along it. Leave empty while it has no address of its own: its line then ends at its page here.',
          'Gdje projekt živi. Prva je kraj linije, ostale su stanice uz nju. Ostavite prazno dok nema svoju adresu: linija tada završava na njegovoj stranici ovdje.',
        ),
        ...rowLabel('url', l('Address', 'Adresa')),
      },
      fields: [
        {
          name: 'url',
          type: 'text',
          label: l('Address', 'Adresa'),
          required: true,
          maxLength: MAX_LINK_LENGTH,
          validate: httpsRule,
          hooks: {
            beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim() : value)],
          },
        },
        {
          name: 'label',
          type: 'text',
          label: l('What is there', 'Što je tamo'),
          localized: true,
          maxLength: MAX_LABEL_LENGTH,
          admin: {
            description: l(
              'Optional, e.g. "Producer site".',
              'Neobavezno, npr. "Stranica producenta".',
            ),
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'started',
          type: 'date',
          label: l('Started', 'Početak'),
          admin: {
            width: '50%',
            date: { pickerAppearance: 'monthOnly', displayFormat: 'MMM yyyy' },
          },
        },
        {
          name: 'stack',
          type: 'text',
          hasMany: true,
          label: l('Built with', 'Izrađeno s'),
          maxRows: 12,
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'story',
      type: 'richText',
      label: l('The story', 'Priča'),
      localized: true,
      validate: richTextRule,
      admin: {
        description: l(
          'Who it is for, what was built and why. Shown on the project’s page.',
          'Za koga je, što je izrađeno i zašto. Prikazuje se na stranici projekta.',
        ),
      },
    },
    {
      name: 'window',
      type: 'upload',
      relationTo: 'media',
      label: l('Window', 'Prozor'),
      admin: {
        description: l(
          'One picture of the destination in its own look (a screenshot works). The only place another brand’s colours appear on this site.',
          'Jedna slika odredišta u njegovom izgledu (snimka zaslona je dovoljna). Jedino mjesto gdje se boje drugog branda pojavljuju na ovom webu.',
        ),
      },
    },
    {
      name: 'windowCaption',
      type: 'text',
      label: l('Window caption', 'Opis prozora'),
      localized: true,
      maxLength: MAX_INTRO_LENGTH,
    },
    seoField,
    slugField('name'),
  ],
}
