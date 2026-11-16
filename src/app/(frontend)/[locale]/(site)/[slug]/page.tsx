import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { RichText } from '@/components/RichText'
import { asLocale } from '@/i18n/server'
import { pageHref } from '@/lib/links'
import { pageMetadata } from '@/lib/metadata'
import { getPage, getPublishedIndex } from '@/lib/payload'

type Props = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, slug } = await params
  const locale = asLocale(raw)
  const page = await getPage(slug, locale)
  if (!page) return {}
  return pageMetadata(locale, page.meta, {
    title: page.title,
    description: page.lead,
    path: pageHref(slug),
  })
}

/** A text page (About, Privacy): its title, lead and text, at reading width. */
export default async function TextPage({ params }: Props) {
  const { locale: raw, slug } = await params
  const locale = asLocale(raw)
  const [page, index] = await Promise.all([getPage(slug, locale), getPublishedIndex()])
  if (!page) notFound()

  return (
    <article className="text-page">
      <header className="page-head">
        <h1 className="fnw-enter" style={{ '--i': 0 } as React.CSSProperties}>
          {page.title}
        </h1>
        {page.lead && (
          <p className="page-head__lead fnw-enter" style={{ '--i': 1 } as React.CSSProperties}>
            {page.lead}
          </p>
        )}
      </header>
      <RichText data={page.content} locale={locale} index={index} />
    </article>
  )
}
