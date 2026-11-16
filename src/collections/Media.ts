import path from 'path'
import type { CollectionConfig } from 'payload'

import { l } from '../i18n/label'

/** Where uploads live on disk (a volume in production). The share cards read the logo from here. */
export const mediaDir = process.env.MEDIA_DIR || path.resolve(process.cwd(), 'media')

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: l('Image', 'Slika'), plural: l('Images', 'Slike') },
  admin: {
    group: l('Content', 'Sadržaj'),
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: l('Image description', 'Opis slike'),
      required: true,
      // Read aloud by screen readers in the page's language, so it is written per language.
      localized: true,
      admin: {
        description: l(
          'Say briefly what the image shows (matters to search engines and to visitors who cannot see it).',
          'Kratko opišite što je na slici (važno za tražilice i slabovidne osobe).',
        ),
      },
    },
  ],
  upload: {
    staticDir: mediaDir,
    mimeTypes: ['image/*'],
    focalPoint: true,
    adminThumbnail: 'thumbnail',
    formatOptions: { format: 'webp', options: { quality: 82 } },
    resizeOptions: { width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true },
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        formatOptions: { format: 'webp', options: { quality: 78 } },
      },
      { name: 'card', width: 900, formatOptions: { format: 'webp', options: { quality: 80 } } },
      { name: 'hero', width: 1800, formatOptions: { format: 'webp', options: { quality: 80 } } },
      // Link previews (Facebook, WhatsApp, Viber): JPEG is the format every app shows.
      {
        name: 'og',
        width: 1200,
        height: 630,
        formatOptions: { format: 'jpeg', options: { quality: 82 } },
      },
    ],
  },
}
