'use client'

import { useEffect } from 'react'

/** How long the train takes per pixel of rail, and at least, in ms. */
const MS_PER_PX = 8
const MIN_RUN = 7000
/** When the first train sets off: once the rail has drawn (notes.css). */
const START = 1700
/** The train's own length, in px (notes.css, .notes-log__train). */
const TRAIN = 24

/**
 * The notes' one motion island: a train runs down the log's rail, and each stop pulses as it
 * passes. Web Animations only, no frame loop; paused while the tab is hidden or the log is off
 * screen; nothing at all under reduced motion. The log reads the same without it.
 */
export function NotesMotion() {
  useEffect(() => {
    const log = document.querySelector<HTMLElement>('.notes-log')
    const train = log?.querySelector<HTMLElement>('.notes-log__train')
    if (!log || !train) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)')
    let running: Animation[] = []
    let visible = true

    const stop = () => {
      running.forEach((animation) => animation.cancel())
      running = []
    }
    const playOrPause = () =>
      running.forEach((animation) =>
        visible && !document.hidden ? animation.play() : animation.pause(),
      )

    const start = () => {
      stop()
      if (reduce.matches) return
      const top = log.getBoundingClientRect().top
      const length = log.offsetHeight - TRAIN
      if (length <= 0) return
      const run = Math.max(MIN_RUN, length * MS_PER_PX)
      running.push(
        train.animate(
          [
            { transform: 'translateY(0)', opacity: 0 },
            { opacity: 1, offset: 0.03 },
            { opacity: 1, offset: 0.95 },
            { transform: `translateY(${length}px)`, opacity: 0 },
          ],
          { duration: run, delay: START, iterations: Infinity },
        ),
      )
      for (const pulse of log.querySelectorAll<HTMLElement>('.notes-log__pulse')) {
        const at = Math.min(0.99, Math.max(0, (pulse.getBoundingClientRect().top - top) / length))
        running.push(
          pulse.animate(
            [
              { transform: 'scale(1)', opacity: 0.9 },
              { transform: 'scale(3.2)', opacity: 0, offset: 0.09 },
              { transform: 'scale(3.2)', opacity: 0 },
            ],
            { duration: run, delay: START + at * run, iterations: Infinity },
          ),
        )
      }
      playOrPause()
    }

    const seen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
      playOrPause()
    })
    seen.observe(log)
    // A new width moves the stops: lay the run out again.
    let width = log.offsetWidth
    const resized = new ResizeObserver(() => {
      if (log.offsetWidth === width) return
      width = log.offsetWidth
      start()
    })
    resized.observe(log)
    document.addEventListener('visibilitychange', playOrPause)
    reduce.addEventListener('change', start)
    start()

    return () => {
      stop()
      seen.disconnect()
      resized.disconnect()
      document.removeEventListener('visibilitychange', playOrPause)
      reduce.removeEventListener('change', start)
    }
  }, [])
  return null
}
