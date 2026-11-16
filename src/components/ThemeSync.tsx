'use client'

import { usePathname } from 'next/navigation'
import { useLayoutEffect } from 'react'

import { themeFor } from '@/lib/motion'

// The head script sets the theme once per document load. Switching EN↔HR is a soft navigation,
// but the [locale] root layout remounts and React resets <html>'s attributes, so data-theme falls
// back to dark for a light-mode visitor. This puts it back on every navigation. React runs layout
// effects inside startViewTransition's update, before the new snapshot, so the crossfade never
// flashes dark into light.
export function ThemeSync() {
  const pathname = usePathname()

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = themeFor(matchMedia)
  }, [pathname])

  return null
}
