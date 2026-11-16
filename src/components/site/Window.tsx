import { getTranslations } from 'next-intl/server'

import { MediaImage } from '@/components/MediaImage'
import type { Locale } from '@/i18n/locales'
import { asMedia, lineNumber } from '@/lib/format'
import { displayAddress } from '@/lib/links'
import type { Project } from '@/payload-types'

/**
 * A window onto the destination (docs/phase-1.md, "Windows"): one real, still picture of its
 * first screen on a phone, in its own colours and type, framed by the station. The only place
 * another brand appears on this site. Not a link (the exit plates are the doors), and nothing
 * touches the picture: no tint, no filter, no motion. Without a picture it renders nothing.
 */
export async function Window({ project, locale }: { project: Project; locale: Locale }) {
  const picture = asMedia(project.window)
  if (!picture) return null
  const t = await getTranslations({ locale, namespace: 'project' })

  const address = project.windowAddress || project.addresses?.[0]?.url
  const caption = project.windowCaption

  return (
    <figure className="window" aria-label={caption ? undefined : t('window')}>
      <div className="window__frame">
        {/* The kicker says the line, the exit plates give the addresses, the alt the picture. */}
        <div className="window__bar" aria-hidden="true">
          <span className="window__addr">{address ? displayAddress(address) : project.name}</span>
          <span className="window__num">{lineNumber(project.line)}</span>
        </div>
        {/* Lazy, Next's default, so it never holds a page change's snapshot up. */}
        <div className="window__view">
          <MediaImage media={picture} sizes="20rem" />
        </div>
      </div>
      {caption && <figcaption className="window__caption">{caption}</figcaption>}
    </figure>
  )
}
