import { relayKey } from './keys'

/**
 * The contact form's own mail account (decision 17): a SEND-ONLY mailbox, for example
 * `website@fromnowhere.dev`, that may submit mail from its own address and nothing else. A
 * compromised server then yields a sending address, never the studio's inbox. It is separate from
 * the admin mail (SMTP_*, password resets) on purpose.
 *
 *   CONTACT_SMTP_HOST   the provider's submission server
 *   CONTACT_SMTP_PORT   587 (STARTTLS, the default) or 465 (TLS from the first byte)
 *   CONTACT_SMTP_USER   the send-only account's login
 *   CONTACT_SMTP_PASS   its password (an app password where the provider has them)
 *   CONTACT_FROM        the address messages are sent from: the send-only account's own
 *   CONTACT_TO          the studio's mailbox that receives them
 */
export type RelayConfig = {
  host: string
  port: number
  user: string
  pass: string
  from: string
  to: string
}

/** Environment variables: `process.env`, or a plain object in the tests. */
type Env = Record<string, string | undefined>

/**
 * A single plain address, as browsers check `type=email` (the WHATWG rule): no display name, no
 * list, no quotes, no spaces or line breaks. Used for the visitor's address too, which ends up in
 * the Reply-To header.
 */
const ADDRESS =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/

export const isPlainAddress = (value: string): boolean => value.length <= 254 && ADDRESS.test(value)

/**
 * The relay's settings, or null when any is missing or malformed. Null means the form REFUSES:
 * there is deliberately no fallback to Payload's mail adapter, whose console fallback reports
 * success and writes the subject (the visitor's name) to the log.
 */
export const readRelayConfig = (env: Env = process.env): RelayConfig | null => {
  const read = (name: string) => env[name]?.trim() ?? ''
  const host = read('CONTACT_SMTP_HOST')
  const user = read('CONTACT_SMTP_USER')
  // A password may legitimately start or end with a space; it is never trimmed.
  const pass = env.CONTACT_SMTP_PASS ?? ''
  const from = read('CONTACT_FROM')
  const to = read('CONTACT_TO')
  const portText = read('CONTACT_SMTP_PORT') || '587'
  const port = /^\d{1,5}$/.test(portText) ? Number(portText) : NaN
  if (!host || !user || !pass || !Number.isInteger(port) || port < 1 || port > 65_535) return null
  if (!isPlainAddress(from) || !isPlainAddress(to)) return null
  return { host, port, user, pass, from, to }
}

/** Whether the form can send at all: the mail account is configured and there is a key to sign
 * the fill-in time and the proof of work with. The contact block shows the form only then. */
export const relayReady = (env: Env = process.env): boolean =>
  readRelayConfig(env) !== null && relayKey('fill-time') !== null
