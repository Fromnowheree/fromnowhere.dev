import { createRateLimiter } from '../rateLimit'

/**
 * Per-address limits for the contact form (decision 18), in memory.
 *
 * Submissions: a burst of five (a visitor correcting a field or two), then one a minute, and at
 * most thirty messages a day from one address. A household or an office behind one
 * mobile operator's shared address fit easily; a script repeating itself does not.
 *
 * The two are spent at different points (src/components/contact/actions.ts). The burst bucket is
 * cheap and comes first, so a flood of bare requests stops before any work is done. The daily cap
 * counts only messages that passed the fill-in time and the proof of work, so requests that cost
 * the sender nothing cannot use up an address's day; if many visitors ever shared one key (see
 * warnIfInternalAddress), bare requests would otherwise close the form for all of them.
 */
export const submissionBurst = createRateLimiter({ capacity: 5, refillPerMinute: 1 })
export const submissionDaily = createRateLimiter({ dailyCap: 30 })

/**
 * Proof-of-work challenges: more generous, since every page view with the form asks for one and
 * the widget asks again after a refused send or an expiry. Creating one costs a few milliseconds
 * and is stateless; the limit only stops a flood.
 */
export const challengeLimiter = createRateLimiter({
  capacity: 20,
  refillPerMinute: 10,
  dailyCap: 500,
})
