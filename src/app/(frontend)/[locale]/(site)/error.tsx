'use client'

import { useTranslations } from 'next-intl'

import { NotFoundMessage } from '@/components/NotFoundMessage'

/**
 * A page that failed while rendering (the database away, a bug): the site's own page, in the
 * page's language and inside its header and footer, with Try again (Next's `retry` renders the
 * page again) and the way home. What went wrong stays in the server's log; the visitor sees no
 * message or stack (Next sends only a digest in production).
 */
export default function SiteError({ retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations('error')
  return (
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
  )
}
