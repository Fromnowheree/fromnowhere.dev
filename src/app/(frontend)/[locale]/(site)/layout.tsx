import { getTranslations } from 'next-intl/server'
import React from 'react'

import { Analytics } from '@/components/Analytics'
import { Motion } from '@/components/Motion'
import { SiteFooter, SiteHeader } from '@/components/site/Chrome'
import { asLocale } from '@/i18n/server'
import { getStudio } from '@/lib/payload'

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> }

/** The site's chrome around every public page. */
export default async function SiteLayout({ children, params }: Props) {
  const locale = asLocale((await params).locale)
  const [studio, t] = await Promise.all([
    getStudio(locale),
    getTranslations({ locale, namespace: 'common' }),
  ])

  return (
    <>
      <a className="skip-link" href="#content">
        {t('skipToContent')}
      </a>
      <SiteHeader locale={locale} />
      <Motion />
      <main id="content" className="site-main wrap">
        {children}
      </main>
      <SiteFooter locale={locale} />
      <Analytics enabled={studio.visitorStatistics} />
    </>
  )
}
