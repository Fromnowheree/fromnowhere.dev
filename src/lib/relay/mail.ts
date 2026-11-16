import nodemailer from 'nodemailer'
import type Mail from 'nodemailer/lib/mailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'

import type { RelayConfig } from './config'

// Every C0 and C1 control character (CR and LF among them) and the two Unicode line separators.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g

/**
 * Text that goes into a mail header (the subject, the display names). Line breaks and every other
 * control character are replaced by a space: a CR/LF in a header is how a sender would append a
 * header of their own (`Bcc:`) or start the body early. Nodemailer encodes what remains.
 */
export const headerText = (value: string, maxLength = 200): string =>
  value.replace(CONTROL_CHARACTERS, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength)

/**
 * How the relay talks to the mail server. The message travels encrypted or not at all
 * (decision 8): port 465 is TLS from the first byte, any other port must upgrade with STARTTLS
 * (`requireTLS`), and a server that does not offer it gets nothing, not even the login. The
 * certificate is checked as usual (no `rejectUnauthorized: false`). Timeouts are short because a
 * visitor is waiting for the answer. Nodemailer's own logging stays off, since it would print
 * the conversation, addresses included.
 */
export const transportOptions = (config: RelayConfig): SMTPTransport.Options => ({
  host: config.host,
  port: config.port,
  secure: config.port === 465,
  requireTLS: true,
  tls: { minVersion: 'TLSv1.2' },
  auth: { user: config.user, pass: config.pass },
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
  logger: false,
  debug: false,
  // The message is built from text only; nothing may be read from a path or fetched from a URL.
  disableFileAccess: true,
  disableUrlAccess: true,
})

export type RelayMessage = {
  /** The site's name, shown as the sender's name next to the send-only address. */
  senderName: string
  subject: string
  text: string
  replyTo: { name: string; address: string }
}

/** The message as handed to nodemailer: From is always the send-only address, Reply-To the
 * visitor (decision 17), so the studio's reply starts the conversation. */
export const composeMessage = (config: RelayConfig, message: RelayMessage): Mail.Options => ({
  from: { name: headerText(message.senderName, 100), address: config.from },
  to: config.to,
  replyTo: { name: headerText(message.replyTo.name, 100), address: message.replyTo.address },
  subject: headerText(message.subject),
  text: message.text,
  disableFileAccess: true,
  disableUrlAccess: true,
})

/** What the relay may say about a failure: a closed code, never the server's reply text, which
 * can quote addresses. */
export type RelayOutcome =
  { accepted: true } | { accepted: false; code: string; responseCode?: number }

// An address object without an address (nodemailer 10 types it optional) matches no recipient.
const addressOf = (entry: string | Mail.Address) =>
  (typeof entry === 'string' ? entry : (entry.address ?? '')).toLowerCase()

/**
 * Hands the message to the mail server and reports whether the server ACCEPTED it for the studio's
 * mailbox. Nothing is queued or retried (decision 19): either the server took it now, or the
 * visitor is told it was not sent.
 */
export const relayMessage = async (
  config: RelayConfig,
  message: RelayMessage,
): Promise<RelayOutcome> => {
  const transport = nodemailer.createTransport(transportOptions(config))
  try {
    const info = await transport.sendMail(composeMessage(config, message))
    const accepted = (info.accepted ?? []).map(addressOf)
    if ((info.rejected ?? []).length === 0 && accepted.includes(config.to.toLowerCase())) {
      return { accepted: true }
    }
    return { accepted: false, code: 'RECIPIENT_REJECTED' }
  } catch (error) {
    const details = (error ?? {}) as { code?: unknown; responseCode?: unknown }
    const code =
      typeof details.code === 'string' && /^[A-Z_]{1,32}$/.test(details.code)
        ? details.code
        : 'SEND_FAILED'
    const responseCode = typeof details.responseCode === 'number' ? details.responseCode : undefined
    return { accepted: false, code, responseCode }
  } finally {
    transport.close()
  }
}
