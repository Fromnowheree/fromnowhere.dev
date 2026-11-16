'use client'

import { useEffect, useState } from 'react'

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * The departures board's clock: the visitor's own local time, ticking each second, with their
 * time zone. The server cannot know either, so it renders the clock hidden and the browser fills
 * it in: without JavaScript there is no clock rather than a made-up one. The colons blink in CSS
 * (board.css), and stop under reduced motion; the time keeps ticking.
 */
export function Clock({ label }: { label: string }) {
  const [clock, setClock] = useState<{ now: Date; zone: string } | null>(null)

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone?.replace(/_/g, ' ') ?? ''
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const now = new Date()
      setClock({ now, zone })
      // On the next whole second, so the display never skips one.
      timer = setTimeout(tick, 1000 - now.getMilliseconds() + 5)
    }
    timer = setTimeout(tick, 0)
    return () => clearTimeout(timer)
  }, [])

  const now = clock?.now
  return (
    <div className="clock" hidden={!now}>
      <time dateTime={now?.toISOString()}>
        {now ? pad(now.getHours()) : '--'}
        <span className="clock__colon">:</span>
        {now ? pad(now.getMinutes()) : '--'}
        <span className="clock__colon">:</span>
        {now ? pad(now.getSeconds()) : '--'}
      </time>
      <small>
        {label}
        {clock?.zone && ` · ${clock.zone}`}
      </small>
    </div>
  )
}
