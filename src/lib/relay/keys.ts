import { createHmac } from 'node:crypto'

/**
 * A secret for one purpose of the contact form, derived from PAYLOAD_SECRET so an installation
 * needs no extra secret to generate. Each purpose gets its own key (an HMAC of a fixed label), so
 * a value signed for one check can never pass another. Rotating PAYLOAD_SECRET only invalidates
 * forms that are open at that moment.
 *
 * Null without PAYLOAD_SECRET: then nothing can be signed and the form refuses.
 */
export const relayKey = (purpose: 'fill-time' | 'proof' | 'proof-key'): string | null => {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) return null
  return createHmac('sha256', secret).update(`contact-form/${purpose}/v1`).digest('hex')
}
