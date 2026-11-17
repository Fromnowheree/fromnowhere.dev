import { headers } from 'next/headers'

import { NONCE_HEADER } from './csp'

/**
 * This request's script nonce (src/proxy.ts, src/lib/csp.ts), for the scripts the site renders
 * itself: the head script and the statistics script. Next's own scripts get it without asking.
 */
export const getNonce = async (): Promise<string | undefined> =>
  (await headers()).get(NONCE_HEADER) ?? undefined
