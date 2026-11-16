import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import { relayKey } from './keys'

/**
 * The minimum fill-in time (decision 18). The page signs the moment it rendered the form; the
 * action refuses a submission that arrives sooner than a person could have typed a name, an
 * e-mail address and a message. The signature (an HMAC with a server-only key) means a script
 * cannot simply claim it opened the form long ago.
 *
 * Each rendered form also gets an id of its own, signed with the time, and a token that has sent
 * a message is spent: a script cannot wait once and then send every message with that one token,
 * and a form submitted again (Back, then Send) does not send the message twice. The token is
 * spent only when the mail server accepted the message, so a visitor whose send failed can try
 * again with the same form.
 */
export const MIN_FILL_MS = 3_000

/** A form older than this was rendered too long ago to vouch for anything; the visitor reloads. */
export const MAX_FORM_AGE_MS = 24 * 3_600_000

export type FillTimeCheck = 'ok' | 'too-fast' | 'expired' | 'used' | 'invalid'

/**
 * Spent tokens, in memory only, each until the form would have expired anyway. Bounded: when it
 * is full of unexpired entries the oldest is forgotten. This is the cheapest of the form's checks
 * and the proof of work still costs every message its own work, so forgetting one is better than
 * refusing visitors.
 */
export const MAX_SPENT = 20_000

export type SpentForms = {
  has(id: string, now: number): boolean
  spend(id: string, expiresAt: number, now: number): void
  size(): number
}

export const createSpentForms = (max: number = MAX_SPENT): SpentForms => {
  const spent = new Map<string, number>()
  return {
    has(id, now) {
      const expiresAt = spent.get(id)
      return expiresAt !== undefined && expiresAt > now
    },
    spend(id, expiresAt, now) {
      if (spent.size >= max) {
        for (const [known, until] of spent) if (until <= now) spent.delete(known)
      }
      // A Map keeps insertion order, so its first key is the oldest.
      if (spent.size >= max) spent.delete(spent.keys().next().value!)
      spent.set(id, expiresAt)
    },
    size: () => spent.size,
  }
}

const spentForms = createSpentForms()

const sign = (key: string, issuedAt: number, id: string) =>
  createHmac('sha256', key).update(`form-rendered:${issuedAt}:${id}`).digest('base64url')

/** The token for a form rendered at `now`, or null when there is no key to sign with. */
export const issueFormToken = (now: number = Date.now()): string | null => {
  const key = relayKey('fill-time')
  if (!key) return null
  const issuedAt = Math.floor(now)
  const id = randomBytes(16).toString('base64url')
  return `${issuedAt}.${id}.${sign(key, issuedAt, id)}`
}

/** The time and id of a genuine token, or null. */
const readToken = (token: string): { issuedAt: number; id: string } | null => {
  const key = relayKey('fill-time')
  const match = /^(\d{1,15})\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/.exec(token)
  if (!key || !match) return null
  const issuedAt = Number(match[1])
  const id = match[2]!
  const expected = Buffer.from(sign(key, issuedAt, id))
  const given = Buffer.from(match[3]!)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  return { issuedAt, id }
}

/** Whether a submitted token is genuine, old enough and not yet spent, judged at `now`. */
export const checkFormToken = (
  token: string,
  now: number = Date.now(),
  spent: SpentForms = spentForms,
): FillTimeCheck => {
  const read = readToken(token)
  if (!read) return 'invalid'
  const age = now - read.issuedAt
  // A signed time in the future did not come from this server's clock.
  if (age < 0) return 'invalid'
  if (age < MIN_FILL_MS) return 'too-fast'
  if (age > MAX_FORM_AGE_MS) return 'expired'
  if (spent.has(read.id, now)) return 'used'
  return 'ok'
}

/** Marks a genuine token as spent: call it once the mail server accepted the message. */
export const spendFormToken = (
  token: string,
  now: number = Date.now(),
  spent: SpentForms = spentForms,
): void => {
  const read = readToken(token)
  if (read) spent.spend(read.id, read.issuedAt + MAX_FORM_AGE_MS, now)
}
