import NextLink from 'next/link'

/** "This line doesn't go anywhere", with a way back to the start. The home link is next/link's, to
 * "/" without a language (not the i18n Link): "/" lands on the visitor's language from anywhere. */
export function NotFoundMessage({
  title,
  text,
  home,
}: {
  title: string
  text: string
  home: string
}) {
  return (
    <section className="not-found">
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
      <p>
        <NextLink className="btn" href="/">
          {home}
        </NextLink>
      </p>
    </section>
  )
}
