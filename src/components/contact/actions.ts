'use server'

import { createTranslator } from 'next-intl'
import { headers } from 'next/headers'

import { defaultLocale, isLocale, localeNames, type Locale } from '@/i18n/locales'
import { messages } from '@/i18n/messages'
import { getMainLanguage, getPayloadClient, getStudio } from '@/lib/payload'
import { clientAddress, warnIfInternalAddress } from '@/lib/rateLimit'
import { isPlainAddress, readRelayConfig } from '@/lib/relay/config'
import { checkFormToken, spendFormToken } from '@/lib/relay/fillTime'
import { submissionBurst, submissionDaily } from '@/lib/relay/limits'
import { headerText, relayMessage } from '@/lib/relay/mail'
import { checkProof } from '@/lib/relay/proof'

export type InquiryState = {
  status: 'idle' | 'success' | 'error'
  message?: string
  errors?: Partial<Record<'name' | 'email' | 'message' | 'consent', string>>
  /** Echoed back so the form keeps what the visitor typed after a refused submit. */
  values?: Record<'name' | 'email' | 'message' | 'consent', string>
}

const field = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim()

type Refusal =
  | 'failed'
  | 'notDelivered'
  | 'unavailable'
  | 'tooMany'
  | 'tooFast'
  | 'stale'
  | 'alreadySent'
  | 'proofMissing'
  | 'proofExpired'
  | 'busy'

/**
 * The contact form: a relay into an e-mail conversation, and nothing else (inherited from
 * NMT-PublicWeb, decisions 8, 17-19, 25). The message goes straight to the studio's mailbox through
 * the form's own send-only account, with Reply-To set to the visitor; NOTHING is stored (no
 * collection, no file, no queue) and nothing the visitor wrote is logged. The visitor is told
 * "sent" only once the mail server has accepted the message; every other outcome says it was not
 * sent and gives the studio's address.
 *
 * The checks run cheapest first, and the proof of work is spent last, only on a message that is
 * otherwise ready to go:
 *   honeypot -> per-address burst limit -> relay configured -> the fields -> minimum fill-in time
 *   -> proof of work (used once) -> per-address daily cap -> the mail server.
 *
 * Every answer is in the language of the page the form was on (its hidden `locale` field); the
 * e-mail to the studio is in the main language.
 */
export async function sendInquiry(_prev: InquiryState, formData: FormData): Promise<InquiryState> {
  const localeInput = field(formData, 'locale')
  const locale: Locale = isLocale(localeInput) ? localeInput : defaultLocale
  const t = createTranslator({ locale, messages: messages[locale], namespace: 'form' })
  const studio = await getStudio(locale)

  const name = field(formData, 'name').slice(0, 120)
  const email = field(formData, 'email').slice(0, 254)
  const message = field(formData, 'message').slice(0, 5000)
  const values = {
    name,
    email,
    message,
    consent: formData.get('consent') === 'on' ? 'on' : '',
  }

  // How to reach the studio instead, appended to every refusal.
  const reach = studio.email ? t('reach.email', { email: studio.email }) : ''
  const refuse = (reason: Refusal, keep = true): InquiryState => ({
    status: 'error',
    message: [t(`refused.${reason}`), reach].filter(Boolean).join(' '),
    values: keep ? values : undefined,
  })

  // Honeypot: people never see or fill this field. A bot gets the plain refusal and nothing back.
  if (field(formData, 'website')) return refuse('failed', false)

  const address = clientAddress(await headers())
  warnIfInternalAddress(address, (text) => void getPayloadClient().then((p) => p.logger.warn(text)))
  if (!submissionBurst.allow(address, Date.now())) return refuse('tooMany')

  // Never Payload's mail adapter: without the relay's own account the form refuses.
  const relay = readRelayConfig()
  if (!relay) return refuse('unavailable')

  const errors: InquiryState['errors'] = {}
  if (!name) errors.name = t('errors.name')
  if (!email) errors.email = t('errors.email')
  else if (!isPlainAddress(email)) errors.email = t('errors.emailInvalid')
  if (!message) errors.message = t('errors.message')
  if (formData.get('consent') !== 'on') errors.consent = t('errors.consent')
  if (Object.keys(errors).length) return { status: 'error', errors, values }

  const fillTime = checkFormToken(field(formData, 'formStarted'))
  if (fillTime === 'too-fast') return refuse('tooFast')
  if (fillTime === 'expired') return refuse('stale')
  if (fillTime === 'used') return refuse('alreadySent')
  if (fillTime !== 'ok') return refuse('failed')

  const proof = await checkProof(field(formData, 'altcha'))
  if (proof === 'missing') return refuse('proofMissing')
  if (proof === 'expired') return refuse('proofExpired')
  if (proof === 'busy') return refuse('busy')
  if (proof !== 'ok') return refuse('failed')

  // Only a message that got this far counts towards the address's day (src/lib/relay/limits.ts).
  if (!submissionDaily.allow(address, Date.now())) return refuse('tooMany')

  const mainLocale = await getMainLanguage()
  const tm = createTranslator({ locale: mainLocale, messages: messages[mainLocale] })
  const none = tm('mail.none')
  const line = (label: string, value: string) => `${label}: ${value || none}`
  const text = [
    tm('mail.intro', { email }),
    '',
    line(tm('mail.name'), headerText(name)),
    line(tm('mail.email'), email),
    line(tm('mail.language'), localeNames[locale]),
    '',
    `${tm('mail.message')}:`,
    message,
    '',
    '--',
    tm('mail.footer'),
  ].join('\n')

  const outcome = await relayMessage(relay, {
    senderName: 'fromnowhere.dev',
    subject: tm('mail.subject', { name: headerText(name) }),
    text,
    replyTo: { name, address: email },
  })

  if (!outcome.accepted) {
    // A closed code only: never the server's reply text, the subject or anything the visitor typed.
    ;(await getPayloadClient()).logger.warn(
      { code: outcome.code, responseCode: outcome.responseCode },
      'Contact form: the mail server did not accept a message; the visitor was told it was not sent',
    )
    return refuse('notDelivered')
  }

  // This form has sent its message; the same token sends no other (src/lib/relay/fillTime.ts).
  spendFormToken(field(formData, 'formStarted'))
  return { status: 'success', message: t('sentDetail', { email }) }
}
