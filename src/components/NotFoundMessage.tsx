import NextLink from 'next/link'
import type { ReactNode } from 'react'

/**
 * "This line doesn't go anywhere", with a way back to the start. The home link is next/link's, to
 * "/" without a language (not the i18n Link): "/" lands on the visitor's language from anywhere.
 *
 * `interrupted` is the error page's version (error.tsx): the line held under the street light, as
 * a delayed line is, with `action` (Try again) before the way home.
 */
export function NotFoundMessage({
  title,
  text,
  home,
  interrupted = false,
  action,
}: {
  title: string
  text: string
  home: string
  interrupted?: boolean
  action?: ReactNode
}) {
  return (
    <section className={`not-found${interrupted ? ' not-found--interrupted' : ''}`}>
      {/* The tab says what happened, like every other page. Next 16 reads metadata only from the
          root not-found, and these are nested, so the title is React's own <title>, which it
          hoists into the head. */}
      <title>{`${title} · Fromnowhere`}</title>
      {/* The point, a line out of it, and the line giving out before any terminal. */}
      <svg className="not-found__line" viewBox="0 0 360 40" aria-hidden="true" focusable="false">
        <circle cx="20" cy="20" r="16" className="not-found__glow" />
        <path d="M34 20 H200" className="not-found__route" />
        <path d="M212 20 H316" className="not-found__route not-found__route--gone" />
        <circle cx="336" cy="20" r="9" className="not-found__end" />
        <circle cx="20" cy="20" r="11" className="not-found__point" />
        <circle cx="20" cy="20" r="4" className="not-found__eye" />
      </svg>
      <h1>{title}</h1>
      <p className="page-head__lead">{text}</p>
      <p className="not-found__actions">
        {action}
        <NextLink className={action ? 'btn btn--quiet' : 'btn'} href="/">
          {home}
        </NextLink>
      </p>
    </section>
  )
}
