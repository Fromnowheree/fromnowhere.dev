import { getTranslations } from 'next-intl/server'

import { NotFoundMessage } from '@/components/NotFoundMessage'

/**
 * A 404 without the site's header and footer, for an address under [locale] that the site layout
 * never renders. Every other 404 is (site)/not-found.tsx, inside the site's chrome.
 */
export default async function NotFound() {
  const t = await getTranslations('notFound')
  return (
    <main className="site-main wrap">
      <NotFoundMessage title={t('title')} text={t('text')} home={t('home')} />
    </main>
  )
}
