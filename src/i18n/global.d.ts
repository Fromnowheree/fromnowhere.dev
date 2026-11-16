import type { Locale } from './locales'
import type { Messages } from './messages'

// Types every next-intl call against the English messages, so a key that does not exist is a
// compile error rather than a raw "nav.servics" on the page. hr.json is held to the same tree by
// tests/int/messages.int.spec.ts.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale
    Messages: Messages
  }
}
