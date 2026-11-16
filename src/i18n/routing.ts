import { defineRouting } from 'next-intl/routing'

import { defaultLocale, locales } from './locales'

/**
 * Every public address carries its language (/en/..., /hr/...). The routing knows every locale the
 * schema has; whether the site serves one is checked per request by the site layout, which 404s
 * a disabled one.
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
  // The proxy answers addresses without a language itself (src/proxy.ts), choosing only among the
  // languages the site serves, so next-intl's own detection never sends anyone to a disabled one.
  localeDetection: false,
  // next-intl would advertise every locale in a Link header, disabled ones included. The pages
  // state their alternates in their metadata instead (src/lib/metadata.ts).
  alternateLinks: false,
})
