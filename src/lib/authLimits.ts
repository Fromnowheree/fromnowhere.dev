import { createRateLimiter, type RateLimiter } from './rateLimit'

/**
 * Per-address limits on the editor's sign-in and password-reset endpoints (src/collections/Users.ts),
 * keyed like the contact form's on the visitor's address (`clientAddress`, the last
 * X-Forwarded-For entry Caddy appends).
 *
 * Payload locks an ACCOUNT after `maxLoginAttempts` wrong passwords, which stops guessing at one
 * account; these limits are per ADDRESS, so one sender also cannot try account after account, or
 * have "forgot password" send mail after mail. They do not stop someone who knows an editor's
 * e-mail from locking that account for a while: the lock is the price of stopping guesses.
 * Generous enough for several editors sharing one connection.
 */
const limits: Record<'login' | 'forgotPassword', RateLimiter[]> = {
  // Sign-in and setting a new password with a reset link: 10 at once, then one a minute.
  login: [
    createRateLimiter({ capacity: 10, refillPerMinute: 1 }),
    createRateLimiter({ dailyCap: 100 }),
  ],
  // A reset mail: 3 at once, then one every 10 minutes.
  forgotPassword: [
    createRateLimiter({ capacity: 3, refillPerMinute: 0.1 }),
    createRateLimiter({ dailyCap: 10 }),
  ],
}

/** True when this address may make one more request of this kind (and counts it). */
export const allowAuthRequest = (
  kind: 'login' | 'forgotPassword',
  address: string,
  now: number,
): boolean => limits[kind].every((limiter) => limiter.allow(address, now))
