import {
  createChallenge,
  randomInt,
  verifySolution,
  type Challenge,
  type Solution,
} from 'altcha-lib'
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2'

import { relayKey } from './keys'

/**
 * Self-hosted proof of work with ALTCHA (decision 18): no third party sees the visitor. The
 * challenge route hands out a signed puzzle, the visitor's browser solves it (a few seconds of
 * PBKDF2, spread over the device's cores), and the action checks the answer here before anything
 * is sent. Sending many messages therefore costs a sender real computing time per message.
 *
 * Difficulty: each attempt is PBKDF2-SHA-256 at PROOF_COST iterations, and the answer is a counter
 * drawn from PROOF_COUNTER, so a browser makes on average about 3,500 attempts (measured in Node:
 * about 1 ms per attempt on one core). The server knows the counter it drew and signs the key it
 * leads to ("deterministic mode"), so checking an answer costs one HMAC, not the search.
 */
export const PROOF_ALGORITHM = 'PBKDF2/SHA-256'
export const PROOF_COST = 5_000
export const PROOF_COUNTER: readonly [number, number] = [2_000, 5_000]

/** How long a challenge may be solved and used. The widget fetches a new one after this. */
export const PROOF_LIFETIME_MS = 30 * 60_000

/** An encoded answer is a few hundred bytes; anything far larger is not one. */
const MAX_PAYLOAD_LENGTH = 4_096

/**
 * Replay protection: every answer is good for ONE message. Used challenges are remembered, in
 * memory only, until their own expiry; after that the signature check refuses them anyway, so
 * nothing needs to be kept longer. The memory is bounded: when it is full of unexpired entries the
 * guard refuses new claims (the form says to call), rather than forgetting one that could then
 * be replayed. Reaching it takes MAX_CLAIMS solved puzzles inside PROOF_LIFETIME_MS, past the
 * per-address rate limit.
 */
export const MAX_CLAIMS = 20_000

export type ReplayGuard = {
  /** Records `id` as used until `expiresAt`, unless it already is or the memory is full. */
  claim(id: string, expiresAt: number, now: number): 'claimed' | 'used' | 'full'
  size(): number
}

export const createReplayGuard = (maxClaims: number = MAX_CLAIMS): ReplayGuard => {
  const claims = new Map<string, number>()
  const prune = (now: number) => {
    for (const [id, expiresAt] of claims) if (expiresAt <= now) claims.delete(id)
  }
  return {
    claim(id, expiresAt, now) {
      const known = claims.get(id)
      if (known !== undefined && known > now) return 'used'
      if (claims.size >= maxClaims) prune(now)
      if (claims.size >= maxClaims) return 'full'
      claims.set(id, expiresAt)
      return 'claimed'
    },
    size: () => claims.size,
  }
}

const usedChallenges = createReplayGuard()

/**
 * A new signed challenge, or null when there is no key to sign with (no PAYLOAD_SECRET).
 * `counter` exists for the tests, which cannot afford the real search on every case; the
 * challenge route and the action always use the production range.
 */
export const createProofChallenge = async ({
  now = Date.now(),
  counter = PROOF_COUNTER,
}: { now?: number; counter?: readonly [number, number] } = {}): Promise<Challenge | null> => {
  const hmacSignatureSecret = relayKey('proof')
  const hmacKeySignatureSecret = relayKey('proof-key')
  if (!hmacSignatureSecret || !hmacKeySignatureSecret) return null
  return createChallenge({
    algorithm: PROOF_ALGORITHM,
    cost: PROOF_COST,
    counter: randomInt(counter[0], counter[1]),
    deriveKey,
    expiresAt: Math.floor((now + PROOF_LIFETIME_MS) / 1000),
    hmacSignatureSecret,
    hmacKeySignatureSecret,
  })
}

export type ProofCheck = 'ok' | 'missing' | 'invalid' | 'expired' | 'used' | 'busy'

type ClientPayload = { challenge: Challenge; solution: Solution }

/** The widget's hidden field: base64 of `{ challenge, solution }`. Anything else is not ours. */
const parsePayload = (encoded: string): ClientPayload | null => {
  if (encoded.length > MAX_PAYLOAD_LENGTH) return null
  try {
    const value: unknown = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))
    if (!value || typeof value !== 'object') return null
    // A remote ("Sentinel") verification carries `verificationData`; this site trusts only
    // puzzles it signed itself, so that shape is refused rather than passed along.
    if ('verificationData' in value) return null
    const { challenge, solution } = value as Partial<ClientPayload>
    if (!challenge?.parameters || typeof challenge.parameters !== 'object') return null
    if (!solution || typeof solution !== 'object') return null
    return { challenge, solution }
  } catch {
    return null
  }
}

/**
 * Checks the visitor's answer and, when it is good, uses it up. Call this only once the message
 * is otherwise ready to send: an answer spent on a form that then fails validation would make the
 * visitor solve a new puzzle for nothing.
 */
export const checkProof = async (
  encoded: string,
  { now = Date.now(), guard = usedChallenges }: { now?: number; guard?: ReplayGuard } = {},
): Promise<ProofCheck> => {
  if (!encoded) return 'missing'
  const hmacSignatureSecret = relayKey('proof')
  const hmacKeySignatureSecret = relayKey('proof-key')
  const payload = parsePayload(encoded)
  if (!payload || !hmacSignatureSecret || !hmacKeySignatureSecret) return 'invalid'
  const { parameters } = payload.challenge
  if (parameters.algorithm !== PROOF_ALGORITHM || !parameters.expiresAt) return 'invalid'

  let result
  try {
    result = await verifySolution({
      challenge: payload.challenge,
      solution: payload.solution,
      deriveKey,
      hmacSignatureSecret,
      hmacKeySignatureSecret,
    })
  } catch {
    return 'invalid'
  }
  if (result.expired) return 'expired'
  if (!result.verified) return 'invalid'

  // The nonce is part of the signed parameters, so it names this one puzzle.
  const claim = guard.claim(parameters.nonce, parameters.expiresAt * 1000, now)
  if (claim === 'used') return 'used'
  if (claim === 'full') return 'busy'
  return 'ok'
}
