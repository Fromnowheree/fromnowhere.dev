'use client'

import { usePathname } from 'next/navigation'
import { useLayoutEffect } from 'react'

import { PLAYED_KEY } from '@/lib/motion'

// Plays entrances once per page per visit: `.fnw-enter` on load (CSS only), `.fnw-reveal` and
// `.fnw-assemble` as they scroll into view. Nothing is ever hidden that someone could already
// see: content on screen when the page wakes up stays as it is, and only content further down
// waits for its reveal. A page seen before in this session, or any page under reduced motion,
// gets `fnw-calm` on <html> and shows everything at once. The layout's inline script makes the
// same call before first paint.

const readPlayed = (): string[] => {
  try {
    return JSON.parse(sessionStorage.getItem(PLAYED_KEY) || '[]')
  } catch {
    return []
  }
}

// Decided once per page, so React's development double effects don't count as a second visit.
let decided: { path: string; calm: boolean } | undefined

export function Motion() {
  const pathname = usePathname()

  // Before paint, so content below the fold is out of sight before it's hidden.
  useLayoutEffect(() => {
    if (decided?.path !== pathname) {
      const played = readPlayed()
      const calm =
        played.includes(pathname) || matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!calm) {
        try {
          sessionStorage.setItem(PLAYED_KEY, JSON.stringify([...played, pathname]))
        } catch {}
      }
      decided = { path: pathname, calm }
    }
    document.documentElement.classList.toggle('fnw-calm', decided.calm)

    const items = Array.from(
      document.querySelectorAll<HTMLElement>('.fnw-reveal:not(.is-in), .fnw-assemble:not(.is-in)'),
    )
    const show = (el: HTMLElement) => el.classList.add('is-in', 'is-shown')
    if (decided.calm) {
      items.forEach(show)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.remove('is-waiting')
          entry.target.classList.add('is-in')
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 },
    )
    for (const el of items) {
      if (el.getBoundingClientRect().top < window.innerHeight) {
        show(el)
      } else {
        el.classList.add('is-waiting')
        observer.observe(el)
      }
    }
    return () => observer.disconnect()
  }, [pathname])

  return null
}
