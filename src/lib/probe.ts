import { isIP } from 'node:net'

/**
 * One knock on a project's address, for the status check (src/jobs/checkStatus.ts): does the
 * server there answer? Any HTTP answer below 500 counts (a 403 from a bot wall is still a server
 * answering); a 5xx, a timeout, a refused connection or a broken certificate does not.
 *
 * The addresses come from the editor and are https only (`httpsRule`), but the check runs inside
 * the server's network, so it knocks only on public names: https, a host name with a dot, never
 * an IP address, localhost or a local suffix, and the same for every redirect it follows (by
 * hand, at most MAX_REDIRECTS). It reads the status line and never the body.
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

// A plain name, no contact details: the sites it knocks on are the studio's own.
const USER_AGENT = 'FromnowhereStatus/1.0 (+https://fromnowhere.dev)'

export async function probe(
  address: string,
  { fetchImpl = fetch, timeoutMs = PROBE_TIMEOUT_MS } = {},
): Promise<ProbeResult> {
  const started = performance.now()
  const elapsed = () => Math.round(performance.now() - started)
  const signal = AbortSignal.timeout(timeoutMs)
  let url = address
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isProbeable(url)) return { answered: false, code: null, ms: elapsed() }
      const response = await fetchImpl(url, {
        method: 'GET',
        redirect: 'manual',
        signal,
        cache: 'no-store',
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
