import type { CollectionConfig, TextFieldSingleValidation } from 'payload'

import { httpsRule } from '../fields/link'
import { richTextRule } from '../fields/richText'
import { rowLabel } from '../fields/rowLabel'
import { seoField } from '../fields/seo'
import { slugField } from '../fields/slug'
import { signedIn } from '../access'
import { l, pickLabel } from '../i18n/label'
import { MAX_INTRO_LENGTH, MAX_LABEL_LENGTH, MAX_LINK_LENGTH } from '../lib/content'

/** How a project's line is drawn: solid while it runs, dashed while it is being built. */
export const PROJECT_STATUSES = ['running', 'building', 'planned', 'paused'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const PROJECT_KINDS = ['product', 'community', 'music', 'client'] as const

/**
 * The window's address is one of the project's own (what the picture is of), or empty for the
 * first. Compared trimmed, as both fields are trimmed before they are saved.
 */
const windowAddressRule: TextFieldSingleValidation = (value, { data, req }) => {
  const address = value?.trim()
  if (!address) return true
  const addresses = (data as { addresses?: { url?: string | null }[] | null }).addresses ?? []
  if (addresses.some((row) => row?.url?.trim() === address)) return true
  return pickLabel(
    req?.i18n?.language,
    l(
      'Use one of this project’s addresses, or leave it empty.',
      'Upišite jednu od adresa ovog projekta ili ostavite prazno.',
    ),
  )
}

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
      type: 'row',
      fields: [
        {
          name: 'client',
          type: 'text',
          label: l('Made for', 'Izrađeno za'),
          localized: true,
          maxLength: 160,
          admin: {
            width: '50%',
            description: l(
              'Who it is for, without naming a private person. E.g. "A homeopathy practice in Varaždin".',
              'Za koga je, bez imena privatnih osoba. Npr. "Homeopatska praksa u Varaždinu".',
            ),
          },
        },
        {
          name: 'scope',
          type: 'text',
          hasMany: true,
          localized: true,
          label: l('The studio’s part', 'Udio studija'),
          maxRows: 8,
          admin: {
            width: '50%',
            description: l(
              'What the studio did, a word or two each. E.g. Design, Build, Hosting.',
              'Što je studio napravio, riječ ili dvije. Npr. Dizajn, Izrada, Hosting.',
            ),
          },
        },
      ],
    },
    {
      type: 'collapsible',
      label: l('The case study', 'Studija slučaja'),
      admin: {
        description: l(
          'Four chapters, shown on the project’s page as stops along its line. Each is optional: an empty one is left out, and with only "What was built" the page shows plain text.',
          'Četiri poglavlja, na stranici projekta prikazana kao stanice uz njegovu liniju. Svako je neobavezno: prazno se izostavlja, a ako je ispunjeno samo "Što je izrađeno", stranica prikazuje običan tekst.',
        ),
      },
      fields: [
        {
          name: 'brief',
          type: 'richText',
          label: l('The brief', 'Zadatak'),
          localized: true,
          validate: richTextRule,
          admin: {
            description: l('Who needed what, and why.', 'Kome je što trebalo i zašto.'),
          },
        },
        {
          name: 'story',
          type: 'richText',
          label: l('What was built', 'Što je izrađeno'),
          localized: true,
          validate: richTextRule,
          admin: {
            description: l(
              'What a visitor and an owner can do with it.',
              'Što s time mogu posjetitelj i vlasnik.',
            ),
          },
        },
        {
          name: 'engineering',
          type: 'richText',
          label: l('Under the surface', 'Ispod površine'),
          localized: true,
          validate: richTextRule,
          admin: {
            description: l(
              'The parts that took real engineering. Only what is true of the code as it is.',
              'Dijelovi koji su tražili pravo inženjerstvo. Samo ono što vrijedi za kod kakav jest.',
            ),
          },
        },
        {
          name: 'outcome',
          type: 'richText',
          label: l('Where it stands', 'Gdje je sada'),
          localized: true,
          validate: richTextRule,
          admin: {
            description: l(
              'What is in service today and what comes next.',
              'Što je danas u pogonu i što slijedi.',
            ),
          },
        },
      ],
    },
    {
      name: 'window',
      type: 'upload',
      relationTo: 'media',
      label: l('Window', 'Prozor'),
      admin: {
        description: l(
          'A phone-width picture (4:5) of one of its published addresses in its own look, taken with pnpm capture:windows. Check that it shows no one’s personal details. The only place another brand’s colours appear on this site.',
          'Slika jedne od njegovih objavljenih adresa na mobitelu (4:5), u vlastitom izgledu, snimljena naredbom pnpm capture:windows. Provjerite da ne prikazuje ničije osobne podatke. Jedino mjesto gdje se boje drugog branda pojavljuju na ovom webu.',
        ),
      },
    },
    {
      name: 'windowAddress',
      type: 'text',
      maxLength: MAX_LINK_LENGTH,
      label: l('The window shows', 'Prozor prikazuje'),
      validate: windowAddressRule,
      hooks: {
        beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim() : value)],
      },
      admin: {
        description: l(
          'Which of the addresses above the picture is of. Empty: the first one.',
          'Koju od gornjih adresa slika prikazuje. Prazno: prvu.',
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
