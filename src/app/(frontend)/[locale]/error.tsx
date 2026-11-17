'use client'

import { useTranslations } from 'next-intl'

import { NotFoundMessage } from '@/components/NotFoundMessage'

/**
 * An error in the site's chrome itself ((site)/layout.tsx: the header or the footer failed), which
 * (site)/error.tsx sits inside and cannot catch: the same page without the chrome.
 */
export default function LocaleError({ retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations('error')
  return (
    <main className="site-main wrap">
      <NotFoundMessage
        interrupted
        title={t('title')}
        text={t('text')}
        home={t('home')}
        action={
          <button type="button" className="btn" onClick={() => retry()}>
            {t('retry')}
          </button>
        }
      />
    </main>
  )
}
