import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { notFound } from 'next/navigation'
import React from 'react'

import { isLocale, ogLocales } from '@/i18n/locales'
import { HeadScript } from '@/components/HeadScript'
import { headScript } from '@/lib/motion'
import { getStudio } from '@/lib/payload'
import { serverUrl } from '@/lib/serverUrl'
import '@/styles/fnw/tokens.css'
import '@/styles/fnw/bundle.css'
import './site.css'
import './routemap.css'
import './board.css'
import './window.css'
import './notes.css'
import './transition.css'

// Content comes from the CMS on every request, so edits in the admin show up immediately
// and the Docker image can be built without a database.
export const dynamic = 'force-dynamic'

// The station is at night in every browser: dark only (site.css).
export const viewport: Viewport = { colorScheme: 'dark', themeColor: '#05060f' }

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

/** The document for every public page: its language, the system's tokens and the night sky. */
export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Before paint: whether this page's entrances play (src/lib/motion.ts). */}
        <HeadScript code={headScript} />
      </head>
      <body>
        {/* The atmosphere behind every page: grid, haze and sodium glow (site.css). */}
        <div className="sky" aria-hidden="true" />
        {/* Messages come from src/i18n/request.ts, for the client components that need them. */}
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
