import type { Field } from 'payload'

import { l } from '../i18n/label'

/** Per-page search engine metadata. Empty fields fall back to sensible defaults. */
export const seoField: Field = {
  name: 'meta',
  type: 'group',
  label: l('SEO (search engines)', 'SEO (tražilice)'),
  admin: {
    description: l(
      'How the page appears in search results. Left empty, the default text is used.',
      'Kako se stranica prikazuje u rezultatima pretraživanja. Ako ostavite prazno, koristi se zadani tekst.',
    ),
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: l('Title in search results', 'Naslov u pretraživaču'),
      localized: true,
      maxLength: 70,
      admin: {
        description: l(
          'Up to ~60 characters, e.g. "Physiotherapy after a knee injury".',
          'Do ~60 znakova, npr. "Fizioterapija nakon ozljede koljena".',
        ),
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: l('Description in search results', 'Opis u pretraživaču'),
      localized: true,
      maxLength: 200,
      admin: {
        description: l(
          'Up to ~155 characters. Say briefly what a visitor finds here.',
          'Do ~155 znakova. Kratko opišite što posjetitelj ovdje može pronaći.',
        ),
      },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: l(
        'Image for sharing (Facebook, WhatsApp…)',
        'Slika za dijeljenje (Facebook, WhatsApp…)',
      ),
      admin: {
        description: l(
          'Left empty, a card with the page title and the logo is shown. A landscape photo of at least 1200 × 630 px looks best.',
          'Ako ostavite prazno, prikazuje se slika s naslovom stranice i logotipom. Najbolje izgleda vodoravna fotografija, barem 1200 × 630 px.',
        ),
      },
    },
  ],
}
