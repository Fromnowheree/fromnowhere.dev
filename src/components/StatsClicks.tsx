'use client'

import { useEffect } from 'react'

import { trackStatsEvent, type StatsEvent } from '@/lib/stats'

/**
 * Counts clicks on elements marked with statsEvent(). It only listens and never cancels the
 * click, so calls, apps and pages open at once; Umami sends with keepalive, so the request
 * survives the navigation.
 */
export function StatsClicks() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const el = event.target.closest<HTMLElement>('[data-stats-event]')
      if (!el) return
      const place = el.dataset.statsPlace
      trackStatsEvent(el.dataset.statsEvent as StatsEvent, place ? { place } : undefined)
    }
    document.addEventListener('click', onClick, { capture: true, passive: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [])

  return null
}
