'use client'

import { usePathname } from 'next/navigation'
import { useLayoutEffect, ViewTransition } from 'react'

// The last pathname this tab rendered. Module scope survives the (site) layout remounting on
// EN↔HR, and React's development double effects see the same path twice and do nothing.
let lastPath: string | undefined

// Every navigation is an exit and an enter of the page box; the header (fnw-nav) is held still.
// Next runs every App Router navigation as a transition, so React's <ViewTransition> animates it;
// CSS `@view-transition` covers only full document loads (transition.css). Two soft navigations
// change at once instead: EN↔HR swaps the [locale] root layout, and a boundary inside <html> does
// not see that, and React flushes back/forward synchronously, with the sync lane, which it never
// animates.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // A layout effect, so focus moves in the commit itself: inside a view transition React runs
  // layout effects in the update callback, while passive effects may wait until the animation has
  // finished, leaving focus on <body> (the clicked link is gone) for up to 280ms.
  useLayoutEffect(() => {
    // A soft navigation to a new page: put focus at the start of the new content, as the skip
    // link would. Not on a full load (lastPath undefined) and not on hash-only changes. An
    // address with a hash ("← All projects", /#projects) names its own start: Next scrolls to
    // it, so focus goes there too, or the next Tab would jump back to the top of the page.
    if (lastPath !== undefined && lastPath !== pathname) {
      const content = document.getElementById('content')
      const target = location.hash ? document.getElementById(location.hash.slice(1)) : null
      if (target && target !== content && content?.contains(target)) {
        // A target, not a control: focusable by script only (transition.css hides its outline).
        if (!target.matches('a[href], button, input, select, textarea, [tabindex]')) {
          target.tabIndex = -1
          target.dataset.focusTarget = ''
        }
        target.focus({ preventScroll: true })
      } else {
        content?.focus({ preventScroll: true })
      }
    }
    lastPath = pathname
  }, [pathname])
  return (
    <ViewTransition key={pathname} enter="fnw-page-in" exit="fnw-page-out" default="none">
      <div className="site-page">{children}</div>
    </ViewTransition>
  )
}
