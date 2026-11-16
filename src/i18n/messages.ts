import en from '../../messages/en.json'
import hr from '../../messages/hr.json'

import type { Locale } from './locales'

/** Both message files, imported statically so a server action or a test can translate without a
 * request (next-intl's request config reads them from here too). */
export const messages: Record<Locale, typeof en> = { en, hr }

export type Messages = typeof en
