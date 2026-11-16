// Per-key rate limiting: a token bucket for bursts and a daily cap, either or both. Copied from NMT
// (apps/website/lib/rateLimit.ts) and owned here; the two repositories are versioned separately.
//
// In memory on purpose: the site is a single process, and the worst a restart does is reset the
// limits for a moment. Nothing about a visitor is written anywhere.
//
// The clock is a parameter everywhere, so the tests own time.

export interface RateLimiterOptions {
  /** Bucket size: how many requests a key may make in a burst. Omit for no burst limit. */
  capacity?: number
  /** Sustained rate: tokens refilled per minute. Required with `capacity`. */
  refillPerMinute?: number
  /** Hard ceiling per key per UTC day. Omit for no daily ceiling. */
  dailyCap?: number
  /** Overrides the tracked-key ceiling (MAX_KEYS). Tests only. */
  maxKeys?: number
}

interface KeyState {
  tokens: number
  lastRefillAt: number
  dayKey: string
  dayCount: number
  lastSeenAt: number
}

const IDLE_EVICT_MS = 24 * 3_600_000

/**
 * Hard ceiling on tracked keys. The key comes from a request header, so anyone can mint fresh keys
 * at will; without a cap, "many distinct addresses" would be a way to exhaust memory over a 24-hour
 * horizon. Past the cap, a new key evicts the least recently seen one.
 */
export const MAX_KEYS = 50_000

const utcDayOf = (now: number): string => new Date(now).toISOString().slice(0, 10)

export interface RateLimiter {
  /** True when the request may proceed (and is counted); false when it is limited. */
  allow(key: string, now: number): boolean
  /** How many keys are tracked, for the tests. */
  size(): number
}

export const createRateLimiter = (options: RateLimiterOptions): RateLimiter => {
  const states = new Map<string, KeyState>()

  const prune = (now: number) => {
    for (const [key, state] of states) {
      if (now - state.lastSeenAt > IDLE_EVICT_MS) states.delete(key)
    }
  }

  let callsSincePrune = 0

  return {
    allow(key, now) {
      if (++callsSincePrune >= 1000) {
        callsSincePrune = 0
        prune(now)
      }

      let state = states.get(key)
      if (!state) {
        if (states.size >= (options.maxKeys ?? MAX_KEYS)) {
          let oldestKey: string | null = null
          let oldestSeen = Number.POSITIVE_INFINITY
          for (const [candidate, candidateState] of states) {
            if (candidateState.lastSeenAt < oldestSeen) {
              oldestSeen = candidateState.lastSeenAt
              oldestKey = candidate
            }
          }
          if (oldestKey) states.delete(oldestKey)
        }
        state = {
          tokens: options.capacity ?? 0,
          lastRefillAt: now,
          dayKey: utcDayOf(now),
          dayCount: 0,
          lastSeenAt: now,
        }
        states.set(key, state)
      }
      state.lastSeenAt = now

      const day = utcDayOf(now)
      if (day !== state.dayKey) {
        state.dayKey = day
        state.dayCount = 0
      }
      if (options.dailyCap !== undefined && state.dayCount >= options.dailyCap) return false

      if (options.capacity !== undefined) {
        const refill = ((now - state.lastRefillAt) / 60_000) * (options.refillPerMinute ?? 0)
        state.tokens = Math.min(options.capacity, state.tokens + refill)
        state.lastRefillAt = now
        if (state.tokens < 1) return false
        state.tokens -= 1
      }
      state.dayCount += 1
      return true
    },
    size: () => states.size,
  }
}

/** The four octets of a dotted IPv4 address, or null when it is not one. */
const ipv4Octets = (address: string): number[] | null => {
  const parts = address.split('.')
  if (parts.length !== 4 || !parts.every((part) => /^\d{1,3}$/.test(part))) return null
  const octets = parts.map(Number)
  return octets.every((octet) => octet <= 255) ? octets : null
}

/** The eight 16-bit groups of an IPv6 address, or null when it is not one. */
const ipv6Groups = (address: string): number[] | null => {
  const halves = address.split('::')
  if (halves.length > 2) return null
  const groups = (part: string): number[] | null => {
    if (!part) return []
    const out: number[] = []
    const pieces = part.split(':')
    for (const [index, piece] of pieces.entries()) {
      // An IPv4 tail (::ffff:192.0.2.7) is the last two groups.
      if (index === pieces.length - 1 && piece.includes('.')) {
        const octets = ipv4Octets(piece)
        if (!octets) return null
        out.push((octets[0]! << 8) | octets[1]!, (octets[2]! << 8) | octets[3]!)
      } else if (/^[0-9a-f]{1,4}$/i.test(piece)) {
        out.push(parseInt(piece, 16))
      } else {
        return null
      }
    }
    return out
  }
  const head = groups(halves[0]!)
  const tail = halves.length === 2 ? groups(halves[1]!) : []
  if (!head || !tail) return null
  if (halves.length === 1) return head.length === 8 ? head : null
  const missing = 8 - head.length - tail.length
  return missing >= 1 ? [...head, ...Array<number>(missing).fill(0), ...tail] : null
}

const hex = (group: number) => group.toString(16)

/**
 * The rate-limit key for one address. An IPv4 address is its own key. An IPv6 address is keyed
 * by its /64 network, because one host is normally handed a whole /64 and could otherwise take a
 * fresh address, and a fresh limit, for every request. An IPv4 address written in IPv6 form
 * (::ffff:192.0.2.7) is the IPv4 address.
 */
export const addressKey = (address: string): string => {
  const plain = address.replace(/^\[|\]$/g, '').replace(/%.*$/, '')
  if (ipv4Octets(plain)) return plain
  const groups = ipv6Groups(plain)
  if (!groups) return plain
  // Loopback stays itself: its /64 (::/64) would look like an ordinary network.
  if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) return '::1'
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return [groups[6]! >> 8, groups[6]! & 255, groups[7]! >> 8, groups[7]! & 255].join('.')
  }
  return `${groups.slice(0, 4).map(hex).join(':')}::/64`
}

/**
 * The visitor's rate-limit key: the LAST `x-forwarded-for` entry, never the first, through
 * addressKey(). Caddy, in front of the app, appends the address it actually saw (and drops what
 * an untrusted client sent); anything earlier in the chain is whatever the client chose to write,
 * so keying on the first entry would let a sender pick a fresh key per request. Without the header
 * (development, no proxy) every request shares one key.
 */
export const clientAddress = (headers: Pick<Headers, 'get'>): string => {
  const chain = headers.get('x-forwarded-for')?.split(',') ?? []
  const last = chain[chain.length - 1]?.trim().slice(0, 64)
  return last ? addressKey(last) : 'unknown'
}

/**
 * True for an address no visitor on the internet has: loopback, private IPv4 ranges (where the
 * container networks live), link-local, IPv6 unique-local, or no address at all.
 */
export const isInternalAddress = (key: string): boolean => {
  const octets = ipv4Octets(key)
  if (octets) {
    const [a, b] = octets as [number, number, number, number]
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127) // carrier-grade NAT, which rootless networking uses
    )
  }
  if (key === '::1') return true
  const groups = ipv6Groups(key.replace(/::\/64$/, '::'))
  if (groups) {
    const first = groups[0]!
    return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80
  }
  return true
}

let warnedInternal = false

/**
 * Logs ONCE per process, in production, when a visitor's key is an internal address. It means
 * the proxy is not seeing visitors' real addresses (rootless Podman's port forwarder, or Docker
 * forwarding IPv6 visitors into an IPv4-only network both show the network's gateway instead), so
 * every visitor shares one rate limit and one script can use it up for everyone. README
 * "Visitors' addresses" says how to deploy so this cannot happen. The address logged is the
 * internal one, never a visitor's.
 */
export const warnIfInternalAddress = (key: string, warn: (message: string) => void): void => {
  if (warnedInternal || process.env.NODE_ENV !== 'production' || !isInternalAddress(key)) return
  warnedInternal = true
  warn(
    `Rate limiting sees the internal address ${key} instead of visitors' own, so all visitors ` +
      'share one limit. Run the stack so the proxy sees real addresses (README, "Visitors\' addresses").',
  )
}

/** Tests only: lets warnIfInternalAddress warn again. */
export const resetInternalAddressWarning = () => {
  warnedInternal = false
}
