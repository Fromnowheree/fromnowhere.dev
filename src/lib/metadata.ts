import type { Metadata } from 'next'

import { ogLocales, type Locale } from '@/i18n/locales'
import type { Media } from '@/payload-types'
import { asMedia } from './format'
import { withLocale } from './links'
import { getServedLocales, getStudio } from './payload'
import { shareCardSize, shareCardUrl } from './shareCard'

type Meta =
  | {
      title?: string | null
      description?: string | null
      image?: number | Media | null
    }
  | null
  | undefined

/** The image chosen in the SEO group, in the JPEG crop made for sharing when it exists. */
const seoImage = (image: Media) => {
  // Uploads from before the 'og' size existed only have the original.
  const file = image.sizes?.og?.url ? image.sizes.og : image
  return {
    url: file.url!, // asMedia() only returns uploads that have a URL
    width: file.width ?? undefined,
    height: file.height ?? undefined,
    type: file.mimeType ?? undefined,
    alt: image.alt,
  }
}

/** A page's address in `locale`; `path` is the same in every language ('/', '/projects/x'). */
export const localizedPath = (locale: Locale, path: string) => withLocale(locale, path)

/**
 * The page's own address as canonical, and every served language as an hreflang alternate, the
 * main language (English) as x-default.
 */
export async function languageAlternates(
  locale: Locale,
  path: string,
): Promise<NonNullable<Metadata['alternates']>> {
  const served = await getServedLocales()
  return {
    canonical: localizedPath(locale, path),
    languages:
      served.length > 1
        ? {
            ...Object.fromEntries(served.map((code) => [code, localizedPath(code, path)])),
            'x-default': localizedPath(served[0]!, path),
          }
        : undefined,
  }
}

/**
 * Builds page metadata from a document's SEO group, falling back to the studio's defaults.
 * Shared links show the image set in the SEO group, otherwise a Fromnowhere card with the title.
 */
export async function pageMetadata(
  locale: Locale,
  meta: Meta,
  fallback: {
    title: string
    description?: string | null
    /** The path without its language, e.g. '/projects/x'. */
    path: string
    /** The home page: its title is the whole title, without " · Fromnowhere" after it. */
    absoluteTitle?: boolean
  },
): Promise<Metadata> {
  const [studio, alternates, served] = await Promise.all([
    getStudio(locale),
    languageAlternates(locale, fallback.path),
    getServedLocales(),
  ])
  const title = meta?.title || fallback.title
  const description =
    meta?.description || fallback.description || studio.defaultDescription || undefined
  const ownImage = asMedia(meta?.image)
  const image = ownImage
    ? seoImage(ownImage)
    : {
        url: shareCardUrl(locale, fallback.path, fallback.title),
        ...shareCardSize,
        alt: `Fromnowhere - ${fallback.title}`,
        type: 'image/png',
      }

  return {
    title: fallback.absoluteTitle ? { absolute: `Fromnowhere · ${title}` } : title,
    description,
    alternates,
    openGraph: {
      title,
      description,
      url: localizedPath(locale, fallback.path),
      locale: ogLocales[locale],
      alternateLocale: served.filter((code) => code !== locale).map((code) => ogLocales[code]),
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  }
}
