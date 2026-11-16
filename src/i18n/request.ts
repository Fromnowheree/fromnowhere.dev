import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'

import { defaultLocale } from './locales'
import { messages } from './messages'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  // The [locale] segment, as matched by the proxy. Anything else never reaches a page: the proxy
  // redirects an address without a known language before rendering starts.
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested) ? requested : defaultLocale
  return { locale, messages: messages[locale] }
})
