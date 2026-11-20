import type { CollectionConfig } from 'payload'

import { signedIn } from '../access'
import { l } from '../i18n/label'

/** The four tracks of /<language>/capabilities, in the order the page lists them. */
export const CAPABILITY_AREAS = ['design', 'build', 'security', 'operations'] as const
export type CapabilityArea = (typeof CAPABILITY_AREAS)[number]

/**
 * One thing the studio knows how to do, said plainly, with where it is built in: this site
 * itself, a project's line, or both. /<language>/capabilities lists them by area and the home
 * page names them. Nothing about capabilities is public until one is published.
 *
 * A capability is a claim, so it is only as good as its proof: write what is true of a site that
 * is running, and name it.
 */
export const Capabilities: CollectionConfig = {
  slug: 'capabilities',
  labels: { singular: l('Capability', 'Vještina'), plural: l('Capabilities', 'Vještine') },
  admin: {
    group: l('Content', 'Sadržaj'),
    useAsTitle: 'title',
    defaultColumns: ['title', 'area', 'order', '_status'],
    description: l(
      'The engineering under the sites, one claim at a time, each with the site that proves it.',
      'Inženjerstvo ispod webova, tvrdnja po tvrdnja, svaka s webom koji je dokazuje.',
    ),
  },
  defaultSort: 'order',
  // The editor's, over the API: the site reads through the Local API (src/lib/payload.ts), which
  // names `_status: published` itself, so a visitor has nothing to read here (tests/e2e/api).
  access: { read: signedIn },
  versions: { drafts: true, maxPerDoc: 25 },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: l('Title', 'Naslov'),
      required: true,
      localized: true,
      maxLength: 80,
      admin: {
        description: l('E.g. "Encrypted backups".', 'Npr. "Šifrirane sigurnosne kopije".'),
      },
    },
    {
      name: 'text',
      type: 'textarea',
      label: l('What it means', 'Što to znači'),
      required: true,
      localized: true,
      maxLength: 400,
      admin: {
        description: l(
          'One or two plain sentences a client can check.',
          'Jedna ili dvije jednostavne rečenice koje klijent može provjeriti.',
        ),
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'area',
          type: 'select',
          label: l('Area', 'Područje'),
          required: true,
          defaultValue: 'build',
          options: [
            { value: 'design', label: l('Design', 'Dizajn') },
            { value: 'build', label: l('Build', 'Izrada') },
            { value: 'security', label: l('Security', 'Sigurnost') },
            { value: 'operations', label: l('Operations', 'Održavanje') },
          ],
          admin: { width: '33%' },
        },
        {
          name: 'order',
          type: 'number',
          label: l('Order', 'Redoslijed'),
          required: true,
          min: 1,
          max: 99,
          defaultValue: 1,
          admin: { width: '33%', step: 1, description: l('Within its area.', 'Unutar područja.') },
        },
        {
          name: 'onThisSite',
          type: 'checkbox',
          label: l('Built into this site', 'Ugrađeno u ovaj web'),
          defaultValue: false,
          admin: { width: '33%' },
        },
      ],
    },
    {
      name: 'projects',
      type: 'relationship',
      relationTo: 'projects',
      hasMany: true,
      maxRows: 12,
      label: l('Built into', 'Ugrađeno u'),
      admin: {
        description: l(
          'The projects where this is true today. Only published ones show.',
          'Projekti na kojima to danas vrijedi. Prikazuju se samo objavljeni.',
        ),
      },
    },
  ],
}
