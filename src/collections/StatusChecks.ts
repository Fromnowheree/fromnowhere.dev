import type { CollectionConfig } from 'payload'

import { l } from '../i18n/label'
import { MAX_LINK_LENGTH } from '../lib/content'

/**
 * What the status check (src/jobs/checkStatus.ts) last heard from each address of a published
 * project: one row per address, written every 5 minutes by the job alone, read by the site to
 * light the board (src/lib/status.ts). Never shown to a visitor as such: the board shows a status
 * and a plain sub-label, never a time or a response time.
 *
 * The editor may look but not touch: the job writes through the Local API, which skips access
 * control. Rows for addresses that are no longer on a published project are removed by the job.
 */
export const StatusChecks: CollectionConfig = {
  slug: 'status-checks',
  labels: {
    singular: l('Status check', 'Provjera statusa'),
    plural: l('Status checks', 'Provjere statusa'),
  },
  admin: {
    group: l('Settings', 'Postavke'),
    useAsTitle: 'url',
    defaultColumns: ['url', 'answered', 'code', 'ms', 'failures', 'checkedAt'],
    description: l(
      'Every 5 minutes the site knocks on each address of a published project. A running project whose first address misses two answers in a row shows as Delayed on the board until it answers again. Written by the check only.',
      'Svakih 5 minuta stranica provjeri svaku adresu objavljenog projekta. Projekt koji radi, a čija prva adresa dvaput zaredom ne odgovori, na ploči je "Kasni" dok ponovno ne odgovori. Upisuje samo provjera.',
    ),
  },
  defaultSort: 'url',
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'url',
      type: 'text',
      label: l('Address', 'Adresa'),
      required: true,
      unique: true,
      maxLength: MAX_LINK_LENGTH,
    },
    {
      name: 'answered',
      type: 'checkbox',
      label: l('Answered', 'Odgovorila'),
      defaultValue: false,
    },
    {
      name: 'code',
      type: 'number',
      label: l('HTTP status', 'HTTP status'),
    },
    {
      name: 'ms',
      type: 'number',
      label: l('Answer time (ms)', 'Vrijeme odgovora (ms)'),
    },
    {
      name: 'failures',
      type: 'number',
      label: l('Missed in a row', 'Zaredom bez odgovora'),
      required: true,
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'checkedAt',
      type: 'date',
      label: l('Checked', 'Provjereno'),
      required: true,
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'answeredAt',
      type: 'date',
      label: l('Last answer', 'Zadnji odgovor'),
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
  ],
}
