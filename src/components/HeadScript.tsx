'use client'

import { useSyncExternalStore } from 'react'

const never = () => () => {}

/**
 * An inline script in <head> that matters only on the document's first load: before paint it
 * marks whether this page's entrances play (src/lib/motion.ts, `headScript`). It is rendered while
 * the server's HTML is hydrated, and not when React mounts the layout afresh on the client (the
 * EN ↔ HR switch remounts it from <html> down): a script React inserts never runs, and React says
 * so in development ("Encountered a script tag"). By then <Motion> has made the same call.
 */
export function HeadScript({ code }: { code: string }) {
  const hydrating = useSyncExternalStore(
    never,
    () => false,
    () => true,
  )
  return hydrating ? <script dangerouslySetInnerHTML={{ __html: code }} /> : null
}
