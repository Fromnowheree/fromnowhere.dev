import { getTranslations } from 'next-intl/server'

import { NotFoundMessage } from '@/components/NotFoundMessage'

export default async function NotFound() {
  const t = await getTranslations('notFound')
  return <NotFoundMessage title={t('title')} text={t('text')} home={t('home')} />
}
