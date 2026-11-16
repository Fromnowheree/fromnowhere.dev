import Image from 'next/image'

import { asMedia } from '@/lib/format'
import type { Media } from '@/payload-types'

type Props = {
  media: number | Media | null | undefined
  sizes: string
  className?: string
  /** The page's one main picture (its largest paint): preloaded from the document's head. */
  preload?: boolean
  /** On the first screen among others (a row of cards): fetched at once rather than lazily. Next 16
   * deprecated `priority`; `preload` is for a single image, `loading="eager"` for several. */
  eager?: boolean
}

export function MediaImage({ media, sizes, className, preload, eager }: Props) {
  const image = asMedia(media)
  if (!image?.url || !image.width || !image.height) return null

  // The editor's focal point decides which part survives a crop. It is per image, so it can only
  // be an inline style; no class could carry it.
  const focal =
    image.focalX != null && image.focalY != null ? `${image.focalX}% ${image.focalY}%` : undefined

  return (
    <Image
      src={image.url}
      alt={image.alt}
      width={image.width}
      height={image.height}
      sizes={sizes}
      className={className}
      preload={preload}
      loading={eager && !preload ? 'eager' : undefined}
      style={focal ? { objectPosition: focal } : undefined}
    />
  )
}
