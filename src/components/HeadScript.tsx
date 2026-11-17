'use client'

import { useSyncExternalStore } from 'react'

const never = () => () => {}

/**
 * An inline script in <head> that matters only on the document's first load: before paint it
 * marks whether this page's entrances play (src/lib/motion.ts, `headScript`). It is rendered while
 * the server's HTML is hydrated, and not when React mounts the layout afresh on the client (the
 * EN ↔ HR switch remounts it from <html> down): a script React inserts never runs, and React says
 * so in development ("Encountered a script tag"). By then <Motion> has made the same call. It
 * carries the request's nonce (src/lib/csp.ts), or the policy would stop it.
 */
export function HeadScript({ code, nonce }: { code: string; nonce?: string }) {
  const hydrating = useSyncExternalStore(
    never,
    () => false,
    () => true,
  )
  // The browser hides a script's nonce once it has read it, so the attribute never matches on
  // hydration; the script itself is unchanged.
  return hydrating ? (
    <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: code }} />
  ) : null
}
