import { lookup as dnsLookup, type LookupAddress } from 'node:dns'
import { request } from 'node:https'
import { BlockList, isIP, type LookupFunction } from 'node:net'

/**
 * One knock on a project's address, for the status check (src/jobs/checkStatus.ts): does the
 * server there answer? Any HTTP answer below 500 counts (a 403 from a bot wall is still a server
 * answering); a 5xx, a timeout, a refused connection or a broken certificate does not.
 *
 * The addresses come from the editor and are https only (`httpsRule`), but the check runs inside
 * the server's network, so it knocks only on public names: https, a host name with a dot, never
 * an IP address, localhost or a local suffix, and the same for every redirect it follows (by
 * hand, at most MAX_REDIRECTS). A public-looking name can still point inside (a record of
 * 127.0.0.1, 10.x, the compose network), so the connection itself resolves the name through
 * `guardedLookup` and refuses any internal address it gets back: the address checked is the one
 * connected to, which a rebinding DNS cannot swap afterwards. It reads the status line and never
 * the body.
 */

export type ProbeResult = {
  answered: boolean
  /** The HTTP status of the last answer, or null with none. */
  code: number | null
  /** How long the answer took, in milliseconds (redirects included). */
  ms: number
}

export const PROBE_TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 5
const LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa']

/** Whether the status check may knock on this address. */
export const isProbeable = (address: string): boolean => {
  let url: URL
  try {
    url = new URL(address)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false
  const host = url.hostname.replace(/\.$/, '').toLowerCase()
  if (!host.includes('.') || isIP(host.replace(/^\[|\]$/g, ''))) return false
  return !LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix))
}

// Addresses that are not on the public internet: this host, private and shared networks,
// link-local, documentation, benchmarking, multicast and reserved ranges, IPv6 unique-local,
// link-local, multicast, NAT64 and IPv4-mapped forms.
const internal = new BlockList()
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3],
] as const)
  internal.addSubnet(net, prefix, 'ipv4')
for (const [net, prefix] of [
  ['::', 127],
  ['64:ff9b::', 96],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const)
  internal.addSubnet(net, prefix, 'ipv6')

/**
 * An IPv4-mapped IPv6 address (`::ffff:1.2.3.4` or `::ffff:102:304`) as its IPv4 address. Not a
 * BlockList rule: BlockList already checks IPv4 addresses against `::ffff:0:0/96`, so such a rule
 * would refuse every IPv4 address.
 */
const unmapped = (ip: string): string | null => {
  const dotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip)
  if (dotted) return dotted[1]!
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(ip)
  if (!hex) return null
  const [hi, lo] = [parseInt(hex[1]!, 16), parseInt(hex[2]!, 16)]
  return [hi >> 8, hi & 255, lo >> 8, lo & 255].join('.')
}

/** Whether an IP address is on the public internet (an IPv4-mapped one by its IPv4 address). */
export const isPublicIp = (ip: string): boolean => {
  const v4 = unmapped(ip)
  if (v4) return isPublicIp(v4)
  const family = isIP(ip)
  if (!family) return false
  return !internal.check(ip, family === 4 ? 'ipv4' : 'ipv6')
}

/**
 * DNS for the status check's connections: every address the name resolves to must be public, or
 * the connection fails with EPRIVATE before it is made.
 */
export const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
    if (error) return callback(error, '', 0)
    if (addresses.length === 0 || addresses.some((a) => !isPublicIp(a.address))) {
      const refused = Object.assign(new Error(`${hostname} resolves to an internal address`), {
        code: 'EPRIVATE',
      })
      return callback(refused, '', 0)
    }
    if (options.all)
      return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, addresses)
    callback(null, addresses[0]!.address, addresses[0]!.family)
  })
}

type Knock = (
  url: string,
  init: { signal: AbortSignal; headers: Record<string, string> },
) => Promise<Response>

/**
 * One GET over HTTPS that resolves through `guardedLookup`, follows nothing and reads nothing:
 * its status and Location as a body-less Response. No connection pool, so every knock resolves
 * the name afresh.
 */
export const guardedFetch: Knock = (url, { signal, headers }) =>
  new Promise((resolve, reject) => {
    const req = request(
      url,
      { method: 'GET', headers, signal, agent: false, lookup: guardedLookup },
      (res) => {
        const status = res.statusCode ?? 0
        const location = res.headers.location
        res.destroy()
        try {
          resolve(new Response(null, { status, headers: location ? { location } : {} }))
        } catch (error) {
          reject(error)
        }
      },
    )
    req.on('error', reject)
    req.end()
  })

// A plain name, no contact details: the sites it knocks on are the studio's own.
const USER_AGENT = 'FromnowhereStatus/1.0 (+https://fromnowhere.dev)'

export async function probe(
  address: string,
  {
    fetchImpl = guardedFetch,
    timeoutMs = PROBE_TIMEOUT_MS,
  }: { fetchImpl?: Knock; timeoutMs?: number } = {},
): Promise<ProbeResult> {
  const started = performance.now()
  const elapsed = () => Math.round(performance.now() - started)
  const signal = AbortSignal.timeout(timeoutMs)
  let url = address
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isProbeable(url)) return { answered: false, code: null, ms: elapsed() }
      const response = await fetchImpl(url, {
        signal,
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*;q=0.8' },
      })
      // The status line is the answer; the page itself is not needed.
      await response.body?.cancel().catch(() => {})
      const location = response.headers.get('location')
      if (response.status >= 300 && response.status < 400 && location) {
        url = new URL(location, url).href
        continue
      }
      return { answered: response.status < 500, code: response.status, ms: elapsed() }
    }
    // Too many redirects: a server that answers, but never arrives anywhere.
    return { answered: false, code: null, ms: elapsed() }
  } catch {
    return { answered: false, code: null, ms: elapsed() }
  }
}
