import { existsSync } from 'node:fs'
import path from 'path'
import type { CollectionConfig } from 'payload'

import { l } from '../i18n/label'

/** Where uploads live on disk (a volume in production). The share cards read the logo from here. */
export const mediaDir = process.env.MEDIA_DIR || path.resolve(process.cwd(), 'media')

/**
 * Whether a file of this name is missing from the uploads folder. A name that would leave the
 * folder is not this check's business (Payload refuses it), so it counts as not missing.
 */
export const isMissingUpload = (filename: string, dir: string = mediaDir): boolean => {
  const root = path.resolve(dir)
  const file = path.resolve(root, filename)
  return file.startsWith(root + path.sep) && !existsSync(file)
}

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: l('Image', 'Slika'), plural: l('Images', 'Slike') },
  admin: {
    group: l('Content', 'Sadržaj'),
  },
  access: {
    // The files themselves are public (the site shows them); the documents are not. Open to
    // anyone, GET /api/media would list every upload, including a window attached to a draft
    // project, which is how a project is kept hidden. Payload's file route passes
    // `isReadingStaticFile`; the site reads documents through the Local API.
    read: ({ req, isReadingStaticFile }) => Boolean(req.user) || Boolean(isReadingStaticFile),
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
    // A picture that is not there is "not found". Payload's own answer is 500 and an error in
    // the log for every such request, on an address anyone can ask for: a crawler following an
    // old link, or someone guessing names, would read as the server failing.
    handlers: [
      (_req, { params }) =>
        isMissingUpload(params.filename) ? new Response('Not found', { status: 404 }) : undefined,
    ],
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
