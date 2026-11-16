import { describe, expect, it, vi } from 'vitest'

import {
  addressKey,
  clientAddress,
  createRateLimiter,
  isInternalAddress,
  resetInternalAddressWarning,
  warnIfInternalAddress,
} from '@/lib/rateLimit'
import { isPlainAddress, readRelayConfig, relayReady } from '@/lib/relay/config'
import {
  checkFormToken,
  createSpentForms,
  issueFormToken,
  MAX_FORM_AGE_MS,
  MIN_FILL_MS,
  spendFormToken,
} from '@/lib/relay/fillTime'
import { headerText } from '@/lib/relay/mail'
import { createReplayGuard } from '@/lib/relay/proof'

const T0 = Date.parse('2026-10-20T10:00:00.000Z')
const MIN = 60_000

// Copied from NMT's apps/website/lib/__tests__/rateLimit.test.ts with the limiter itself.
describe('createRateLimiter', () => {
  it('allows a burst up to capacity, then refuses', () => {
    const limiter = createRateLimiter({ capacity: 3, refillPerMinute: 1, dailyCap: 100 })
    expect([1, 2, 3, 4].map(() => limiter.allow('a', T0))).toEqual([true, true, true, false])
  })

  it('refills at the sustained rate', () => {
    const limiter = createRateLimiter({ capacity: 2, refillPerMinute: 1, dailyCap: 100 })
    limiter.allow('a', T0)
    limiter.allow('a', T0)
    expect(limiter.allow('a', T0 + 30_000)).toBe(false) // half a token
    expect(limiter.allow('a', T0 + MIN)).toBe(true)
  })

  it('keeps keys independent', () => {
    const limiter = createRateLimiter({ capacity: 1, refillPerMinute: 1, dailyCap: 100 })
    expect(limiter.allow('a', T0)).toBe(true)
    expect(limiter.allow('b', T0)).toBe(true)
    expect(limiter.allow('a', T0)).toBe(false)
  })

  it('enforces the daily cap across refills and resets on the next UTC day', () => {
    const limiter = createRateLimiter({ capacity: 5, refillPerMinute: 60, dailyCap: 3 })
    let t = T0
    for (let i = 0; i < 3; i++) {
      expect(limiter.allow('a', t)).toBe(true)
      t += 5 * MIN
    }
    expect(limiter.allow('a', t)).toBe(false)
    expect(limiter.allow('a', Date.parse('2026-10-21T00:00:01.000Z'))).toBe(true)
  })

  it('caps the tracked keys by evicting the least recently seen', () => {
    const limiter = createRateLimiter({
      capacity: 1,
      refillPerMinute: 1,
      dailyCap: 100,
      maxKeys: 3,
    })
    limiter.allow('a', T0)
    limiter.allow('b', T0 + 1)
    limiter.allow('c', T0 + 2)
    // Minting fresh keys cannot grow the map; 'a' returning starts a fresh bucket.
    limiter.allow('d', T0 + 3)
    expect(limiter.size()).toBe(3)
    expect(limiter.allow('a', T0 + 4)).toBe(true)
  })

  it('stays bounded however many addresses a sender invents', () => {
    const limiter = createRateLimiter({
      capacity: 1,
      refillPerMinute: 1,
      dailyCap: 100,
      maxKeys: 100,
    })
    for (let i = 0; i < 5_000; i++) limiter.allow(`203.0.113.${i}`, T0 + i)
    expect(limiter.size()).toBeLessThanOrEqual(100)
  })

  it('can be a daily cap alone, with no burst limit', () => {
    const limiter = createRateLimiter({ dailyCap: 3 })
    expect([1, 2, 3, 4].map(() => limiter.allow('a', T0))).toEqual([true, true, true, false])
    expect(limiter.allow('a', Date.parse('2026-10-21T00:00:01.000Z'))).toBe(true)
  })

  it('can be a burst limit alone, with no daily cap', () => {
    const limiter = createRateLimiter({ capacity: 1, refillPerMinute: 1 })
    let allowed = 0
    for (let i = 0; i < 100; i++) if (limiter.allow('a', T0 + i * MIN)) allowed++
    expect(allowed).toBe(100)
    expect(limiter.allow('a', T0 + 99 * MIN)).toBe(false)
  })

  it('never refills past capacity', () => {
    const limiter = createRateLimiter({ capacity: 2, refillPerMinute: 60, dailyCap: 100 })
    limiter.allow('a', T0)
    const later = T0 + 60 * MIN
    expect([1, 2, 3].map(() => limiter.allow('a', later))).toEqual([true, true, false])
  })
})

describe('clientAddress', () => {
  const from = (value?: string) =>
    clientAddress(new Headers(value ? { 'x-forwarded-for': value } : {}))

  it('takes the entry the proxy appended (the last), never one the client wrote', () => {
    expect(from('10.0.0.1, 192.0.2.7')).toBe('192.0.2.7')
    expect(from('anything-at-all,  192.0.2.7 ')).toBe('192.0.2.7')
    expect(from('192.0.2.7')).toBe('192.0.2.7')
  })

  it('shares one key when there is no proxy header', () => {
    expect(from()).toBe(from(''))
  })

  it('keys an IPv6 visitor by the /64 network, however the address is written', () => {
    const key = from('2001:db8:1:2::1')
    expect(from('2001:0db8:0001:0002:ffff:ffff:ffff:ffff')).toBe(key)
    expect(from('[2001:db8:1:2:a:b:c:d]')).toBe(key)
    expect(from('2001:db8:1:2::1%eth0')).toBe(key)
    expect(from('2001:db8:1:3::1')).not.toBe(key)
    expect(from('2001:db8::1')).not.toBe(key)
  })

  it('keys an IPv4 address written as IPv6 as the IPv4 address itself', () => {
    expect(from('::ffff:192.0.2.7')).toBe(from('192.0.2.7'))
    expect(from('::ffff:c000:207')).toBe(from('192.0.2.7'))
    // Two IPv4 visitors are two keys, not one shared ::ffff:0:0/64.
    expect(from('::ffff:192.0.2.8')).not.toBe(from('::ffff:192.0.2.7'))
  })

  it('passes anything that is not an address through as it is', () => {
    expect(addressKey('not-an-address')).toBe('not-an-address')
    expect(addressKey('1:2:3:4:5:6:7:8:9')).toBe('1:2:3:4:5:6:7:8:9')
    expect(addressKey('256.1.1.1')).toBe('256.1.1.1')
  })
})

describe('internal addresses', () => {
  it('are told apart from visitors’ addresses', () => {
    for (const internal of [
      '10.89.0.1',
      '172.18.0.1',
      '192.168.1.20',
      '127.0.0.1',
      '169.254.1.1',
      '100.64.0.1',
      addressKey('fd00:dead:beef::1'),
      addressKey('fe80::1'),
      addressKey('::1'),
      'unknown',
    ]) {
      expect(isInternalAddress(internal), internal).toBe(true)
    }
    for (const visitor of ['192.0.2.7', '172.32.0.1', '8.8.8.8', addressKey('2001:db8:1:2::1')]) {
      expect(isInternalAddress(visitor), visitor).toBe(false)
    }
  })

  it('are reported once, and only in production', () => {
    const warn = vi.fn()
    try {
      resetInternalAddressWarning()
      warnIfInternalAddress('172.18.0.1', warn)
      expect(warn).not.toHaveBeenCalled()

      vi.stubEnv('NODE_ENV', 'production')
      warnIfInternalAddress('192.0.2.7', warn)
      expect(warn).not.toHaveBeenCalled()
      warnIfInternalAddress('172.18.0.1', warn)
      warnIfInternalAddress('10.0.0.2', warn)
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]?.[0]).toContain('172.18.0.1')
    } finally {
      vi.unstubAllEnvs()
      resetInternalAddressWarning()
    }
  })
})

describe('the minimum fill-in time', () => {
  it('accepts a genuine form once enough time has passed', () => {
    const token = issueFormToken(T0)!
    expect(checkFormToken(token, T0 + MIN_FILL_MS - 1)).toBe('too-fast')
    expect(checkFormToken(token, T0 + MIN_FILL_MS)).toBe('ok')
    expect(checkFormToken(token, T0 + MAX_FORM_AGE_MS)).toBe('ok')
    expect(checkFormToken(token, T0 + MAX_FORM_AGE_MS + 1)).toBe('expired')
  })

  it('is spent by the message it sent, and only that form is', () => {
    const spent = createSpentForms()
    const token = issueFormToken(T0)!
    const other = issueFormToken(T0)!
    spendFormToken(token, T0 + MIN, spent)
    expect(checkFormToken(token, T0 + 2 * MIN, spent)).toBe('used')
    expect(checkFormToken(other, T0 + 2 * MIN, spent)).toBe('ok')
  })

  it('remembers spent forms in bounded memory, forgetting expired ones first', () => {
    const spent = createSpentForms(2)
    const [a, b, c] = [issueFormToken(T0)!, issueFormToken(T0)!, issueFormToken(T0 + MIN)!]
    spendFormToken(a, T0 + MIN, spent)
    spendFormToken(b, T0 + MIN, spent)
    // Full: the oldest gives way.
    spendFormToken(c, T0 + 2 * MIN, spent)
    expect(spent.size()).toBe(2)
    expect(checkFormToken(a, T0 + 3 * MIN, spent)).toBe('ok')
    expect(checkFormToken(c, T0 + 3 * MIN, spent)).toBe('used')
    // Once a and b's forms have expired, they make room before anything unexpired is forgotten.
    const d = issueFormToken(T0 + MAX_FORM_AGE_MS)!
    spendFormToken(d, T0 + MAX_FORM_AGE_MS + MIN_FILL_MS + 1, spent)
    expect(checkFormToken(c, T0 + MAX_FORM_AGE_MS, spent)).toBe('used')
  })

  it('refuses a time the server did not sign', () => {
    const token = issueFormToken(T0)!
    const [, id, signature] = token.split('.')
    expect(checkFormToken(`${T0 - 10 * MIN}.${id}.${signature}`, T0)).toBe('invalid')
    expect(checkFormToken(`${T0 - 10 * MIN}`, T0)).toBe('invalid')
    expect(checkFormToken('', T0)).toBe('invalid')
    expect(checkFormToken(`${token}x`, T0 + MIN)).toBe('invalid')
  })

  it('refuses a signed time in the future', () => {
    expect(checkFormToken(issueFormToken(T0 + MIN)!, T0)).toBe('invalid')
  })

  it('cannot sign or check anything without PAYLOAD_SECRET', () => {
    const secret = process.env.PAYLOAD_SECRET
    const token = issueFormToken(T0)!
    try {
      delete process.env.PAYLOAD_SECRET
      expect(issueFormToken(T0)).toBeNull()
      expect(checkFormToken(token, T0 + MIN)).toBe('invalid')
    } finally {
      process.env.PAYLOAD_SECRET = secret
    }
  })
})

describe('the replay guard', () => {
  it('lets each puzzle through once while it is valid', () => {
    const guard = createReplayGuard(10)
    expect(guard.claim('n1', T0 + MIN, T0)).toBe('claimed')
    expect(guard.claim('n1', T0 + MIN, T0 + 1)).toBe('used')
    expect(guard.claim('n2', T0 + MIN, T0 + 1)).toBe('claimed')
  })

  it('forgets a puzzle only once it has expired, and stays bounded', () => {
    const guard = createReplayGuard(3)
    for (const id of ['a', 'b', 'c']) expect(guard.claim(id, T0 + MIN, T0)).toBe('claimed')
    // Full of live entries: refuse rather than forget one that could then be replayed.
    expect(guard.claim('d', T0 + MIN, T0 + 1)).toBe('full')
    expect(guard.claim('a', T0 + MIN, T0 + 1)).toBe('used')
    // Once they expire they make room.
    expect(guard.claim('d', T0 + 2 * MIN, T0 + MIN)).toBe('claimed')
    expect(guard.size()).toBeLessThanOrEqual(3)
  })
})

describe('headerText', () => {
  it('leaves no line break or control character in a header value', () => {
    for (const value of [
      'a\r\nBcc: x@example.net',
      'a\nb',
      'a\rb',
      'a\u2028b',
      'a\u2029b',
      'a\u0000b',
      'a\u0085b',
      'a\tb',
    ]) {
      expect(headerText(value)).toMatch(/^[^\u0000-\u001f\u007f-\u009f\u2028\u2029]*$/)
    }
    expect(headerText('  Ana \r\n  Example ')).toBe('Ana Example')
  })

  it('keeps names in any script', () => {
    expect(headerText('Đurđica Šimić')).toBe('Đurđica Šimić')
  })

  it('is bounded', () => {
    expect(headerText('x'.repeat(1000))).toHaveLength(200)
  })
})

describe('the relay settings', () => {
  const env = {
    CONTACT_SMTP_HOST: 'smtp.example.com',
    CONTACT_SMTP_PORT: '',
    CONTACT_SMTP_USER: 'website@example.com',
    CONTACT_SMTP_PASS: ' secret with spaces ',
    CONTACT_FROM: 'website@example.com',
    CONTACT_TO: 'studio-inbox@example.com',
  }

  it('reads a complete account, port 587 by default, the password untouched', () => {
    expect(readRelayConfig(env)).toEqual({
      host: 'smtp.example.com',
      port: 587,
      user: 'website@example.com',
      pass: ' secret with spaces ',
      from: 'website@example.com',
      to: 'studio-inbox@example.com',
    })
  })

  it('is off when anything is missing or malformed', () => {
    for (const name of Object.keys(env).filter((key) => key !== 'CONTACT_SMTP_PORT')) {
      expect(readRelayConfig({ ...env, [name]: '' }), name).toBeNull()
    }
    for (const port of ['0', '65536', 'smtp', '58 7', '-1']) {
      expect(readRelayConfig({ ...env, CONTACT_SMTP_PORT: port }), port).toBeNull()
    }
    expect(readRelayConfig({ ...env, CONTACT_FROM: 'Website <website@example.com>' })).toBeNull()
    expect(relayReady({ ...env, CONTACT_TO: '' })).toBe(false)
    expect(relayReady(env)).toBe(true)
  })

  it('accepts only single plain addresses', () => {
    expect(isPlainAddress('ana.example+form@mail.example.co.uk')).toBe(true)
    for (const value of [
      'a@b',
      'a b@example.com',
      'a@example.com,b@example.com',
      '<a@example.com>',
      'a@example.com\n',
      'a@-example.com',
    ]) {
      expect(isPlainAddress(value), value).toBe(false)
    }
  })
})
