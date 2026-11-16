import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { notFound } from 'next/navigation'
import React from 'react'

import { isLocale, ogLocales } from '@/i18n/locales'
import { PLAYED_KEY } from '@/lib/motion'
import { getStudio } from '@/lib/payload'
import { serverUrl } from '@/lib/serverUrl'
import '@/styles/fnw/tokens.css'
import '@/styles/fnw/bundle.css'
import './site.css'

// Content comes from the CMS on every request, so edits in the admin show up immediately
// and the Docker image can be built without a database.
export const dynamic = 'force-dynamic'

// Runs before paint. Dark is the brand's primary theme; a device set to light gets the light pair
// (design/README.md). Then the same call <Motion> makes: a page already seen this session, or
// reduced motion, skips its entrance (fnw-calm).
const headScript = `(function(d){try{if(matchMedia('(prefers-color-scheme: light)').matches)d.dataset.theme='light';var p=JSON.parse(sessionStorage.getItem('${PLAYED_KEY}')||'[]');if(p.indexOf(location.pathname)>-1||matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('fnw-calm')}catch(e){}})(document.documentElement)`

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const studio = await getStudio(locale)
  return {
    metadataBase: new URL(serverUrl),
    title: { default: 'Fromnowhere', template: '%s · Fromnowhere' },
    description: studio.defaultDescription ?? undefined,
    openGraph: { siteName: 'Fromnowhere', locale: ogLocales[locale], type: 'website' },
    verification: studio.googleSiteVerification
      ? { google: studio.googleSiteVerification }
      : undefined,
  }
}

/** The document for every public page: its language, the system's tokens and the theme. */
export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <html lang={locale} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: headScript }} />
      </head>
      <body>
        {/* Messages come from src/i18n/request.ts, for the client components that need them. */}
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
