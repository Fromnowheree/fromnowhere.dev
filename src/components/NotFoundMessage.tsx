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
      <svg className="not-found__line" viewBox="0 0 320 40" aria-hidden focusable="false">
        <circle cx="20" cy="20" r="11" className="not-found__point" />
        <path d="M31 20 H220" className="not-found__route" />
        <path d="M220 20 H300" className="not-found__route not-found__route--gone" />
      </svg>
      <h1>{title}</h1>
      <p className="page-head__lead">{text}</p>
      <p>
        <NextLink className="fnw-btn fnw-btn--secondary" href="/">
          {home}
        </NextLink>
      </p>
    </section>
  )
}
