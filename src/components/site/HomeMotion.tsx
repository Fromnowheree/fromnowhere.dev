'use client'

import { useEffect } from 'react'

/** A lit line's trains run this many times faster. */
const LIT_RATE = 3
/** How long a line's trains take to change speed, in ms. */
const RAMP = 260
/** A train on a line under construction slows towards the frontier, then waits this long (as a
 * share of its run) before the next one sets off. */
const BUILDING_CYCLE = 1.35

type Line = {
  slug: string
  group: SVGGElement
  running: boolean
  pulse: SVGCircleElement | null
  terminal: SVGCircleElement | null
  colour: string
  trains: Animation[]
  rate: number
  frame: number
}

/** How far up the window the map's top comes before its opening plays, as a share of the window. */
const OPENING_AT = 0.85

/** A section's head settles under the window's top again only after it has been this far down
 * the window (a share of its height): further than any browser's reach for a near snap point, so
 * a section that has let go never pulls a visitor back. */
const SETTLE_FROM = 0.55
/** The strip map's stop is the last section whose top is above this line (a share of the
 * window's height from its top); over the page's last screen the line sinks to the window's
 * foot, so the last, short sections get their turn. */
const HERE_AT = 0.45

/** The animations under an element that end: an opening's, not the ambient loops. */
const finite = (root: Element) =>
  root
    .getAnimations({ subtree: true })
    .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)

/** The map's layout on screen now (the other is display: none). */
const shownSvg = (map: HTMLElement) =>
  [...map.querySelectorAll<SVGSVGElement>('.map__svg')].find(
    (svg) => svg.getBoundingClientRect().width > 0,
  ) ?? null

/** A train's run as keyframes over the inherited dash of its three strokes. */
function trainKeyframes(
  group: SVGGElement,
  train: number,
): { keyframes: Keyframe[]; cycle: number } {
  const length = Number(group.dataset.length)
  const built = Number(group.dataset.built)
  if (group.dataset.state === 'building' && built > 0) {
    // It slows as it nears the frontier and fades before it, never reaching the terminal.
    return {
      cycle: BUILDING_CYCLE,
      keyframes: [
        {
          offset: 0,
          strokeDashoffset: `${train}px`,
          opacity: 0,
          easing: 'cubic-bezier(0.3, 0.66, 0.55, 1)',
        },
        { offset: 0.1 / BUILDING_CYCLE, opacity: 1 },
        { offset: 0.82 / BUILDING_CYCLE, opacity: 1 },
        { offset: 1 / BUILDING_CYCLE, strokeDashoffset: `${train - built}px`, opacity: 0 },
        { offset: 1, strokeDashoffset: `${train - built}px`, opacity: 0 },
      ],
    }
  }
  return {
    cycle: 1,
    keyframes: [
      { offset: 0, strokeDashoffset: `${train}px`, opacity: 0 },
      { offset: Math.min(0.2, 30 / length), opacity: 1 },
      { offset: 1 - Math.min(0.2, 26 / length), opacity: 1 },
      { offset: 1, strokeDashoffset: `${train - length}px`, opacity: 0 },
    ],
  }
}

/**
 * The home page's motion, on top of a map and a board the server rendered whole
 * (docs/prototypes/night-transit.html). CSS draws the map's opening on every visit; this adds:
 *
 * - the opening's timing: the map is below the hero's screen, so its opening is started over and
 *   held at its first frame until the map comes into view, then played;
 * - trains, one Web Animation each, running along their line after it is drawn, with an arrival
 *   pulse at the terminal; paused while the tab is hidden or the map is off screen;
 * - lighting: pointing at or focusing a line, its terminal or its board row lights that line on
 *   the map and the board, dims the others and speeds its trains up;
 * - the board's rows sweeping in as it comes into view, and the bands under it (services, the
 *   works, notes, the contact band) arriving as each comes into view;
 * - settling: a scroll that ends near the head of the map or the board, coming down to it, comes
 *   to rest on it (CSS scroll snap, armed here for the next one down only);
 * - the strip map: which stop the visitor is at, and a smooth ride to a stop that is clicked.
 *
 * Nothing here hides content that was already on screen, and under reduced motion it adds only
 * the lighting and the strip map's stop.
 */
export function HomeMotion() {
  useEffect(() => {
    const map = document.getElementById('route-map')
    const board = document.getElementById('departures')
    const reduce = matchMedia('(prefers-reduced-motion: reduce)')
    const cleanups: (() => void)[] = []
    const ground =
      getComputedStyle(document.documentElement).getPropertyValue('--ground').trim() || '#090b19'

    // ── trains ──────────────────────────────────────────────────────────
    let lines: Line[] = []
    let svg: SVGSVGElement | null = null
    let onScreen = true
    let generation = 0
    const live = () => !document.hidden && onScreen && !reduce.matches

    const pulse = (line: Line) => {
      if (!live()) return
      line.pulse?.animate(
        [
          { transform: 'scale(1)', opacity: 0.9 },
          { transform: 'scale(3.2)', opacity: 0 },
        ],
        { duration: 900, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
      )
      line.terminal?.animate([{ fill: ground }, { fill: line.colour }, { fill: ground }], {
        duration: 700,
      })
    }

    const runTrains = (line: Line) => {
      const trainLength = Number(svg?.dataset.train) || 22
      const period = Number(line.group.dataset.period) || 6000
      const { keyframes, cycle } = trainKeyframes(line.group, trainLength)
      const cars = [...line.group.querySelectorAll<SVGGElement>('.train')]
      cars.forEach((car, k) => {
        const duration = period * cycle * (0.9 + Math.random() * 0.2)
        const animation = car.animate(keyframes, { duration, fill: 'both' })
        animation.currentTime = ((k / cars.length + Math.random() * 0.08) % 1) * duration
        animation.updatePlaybackRate(line.rate)
        animation.onfinish = () => {
          if (line.running) pulse(line)
          animation.play()
        }
        if (!live()) animation.pause()
        line.trains.push(animation)
      })
    }

    const stopTrains = () => {
      generation++
      for (const line of lines) {
        cancelAnimationFrame(line.frame)
        line.trains.forEach((animation) => animation.cancel())
      }
      lines = []
      svg = null
    }

    const startTrains = () => {
      stopTrains()
      if (!map || reduce.matches) return
      svg = shownSvg(map)
      if (!svg) return
      const started = generation
      lines = [...svg.querySelectorAll<SVGGElement>('.line[data-line]')].map((group) => ({
        slug: group.dataset.line ?? '',
        group,
        running: group.dataset.state === 'running',
        pulse: group.querySelector<SVGCircleElement>('.line__pulse'),
        terminal: group.querySelector<SVGCircleElement>('.line__terminal'),
        colour: getComputedStyle(group).getPropertyValue('--c').trim(),
        trains: [],
        rate: group.dataset.line === active ? LIT_RATE : 1,
        frame: 0,
      }))
      for (const line of lines) {
        if (!line.group.querySelector('.train')) continue
        // A line's trains set off once it has been drawn (its opening's finite animations).
        Promise.all(
          finite(line.group).map((animation) => animation.finished.catch(() => undefined)),
        ).then(() => {
          if (generation === started) runTrains(line)
        })
      }
    }

    const setRunning = () => {
      const on = live()
      for (const line of lines)
        for (const animation of line.trains) {
          if (on && animation.playState === 'paused') animation.play()
          else if (!on && animation.playState === 'running') animation.pause()
        }
    }

    const rampTo = (line: Line, target: number) => {
      cancelAnimationFrame(line.frame)
      const from = line.rate
      const begin = performance.now()
      const step = (now: number) => {
        const k = Math.min(1, (now - begin) / RAMP)
        line.rate = from + (target - from) * (1 - (1 - k) ** 2)
        line.trains.forEach((animation) => animation.updatePlaybackRate(line.rate))
        if (k < 1) line.frame = requestAnimationFrame(step)
      }
      line.frame = requestAnimationFrame(step)
    }

    // ── lighting: map ↔ board ───────────────────────────────────────────
    let active: string | null = null
    const lit = (slug: string | null) => {
      if (slug === active) return
      active = slug
      if (map) {
        if (slug) map.dataset.active = slug
        else delete map.dataset.active
      }
      document
        .querySelectorAll<Element>('#route-map [data-line], #departures .row[data-line]')
        .forEach((el) => el.classList.toggle('is-active', el.getAttribute('data-line') === slug))
      for (const line of lines) rampTo(line, line.slug === slug ? LIT_RATE : 1)
    }
    /** The line a pointer or focus is on: a terminal, a line's hit stroke, a stop, a board row. */
    const lineOf = (target: EventTarget | null): string | null => {
      if (!(target instanceof Element)) return null
      const holder = target.closest('.term, .line, .row')
      return holder?.getAttribute('data-line') ?? null
    }
    const listen = <K extends keyof HTMLElementEventMap>(
      el: HTMLElement | null,
      type: K,
      handler: (event: HTMLElementEventMap[K]) => void,
    ) => {
      if (!el) return
      el.addEventListener(type, handler)
      cleanups.push(() => el.removeEventListener(type, handler))
    }
    for (const area of [map, board]) {
      listen(area, 'pointerover', (event) => lit(lineOf(event.target)))
      listen(area, 'pointerleave', () => lit(null))
      listen(area, 'focusin', (event) => lit(lineOf(event.target)))
      listen(area, 'focusout', (event) => {
        if (!lineOf(event.relatedTarget)) lit(null)
      })
    }
    // A line's stroke is a way into its project, like its terminal.
    listen(map, 'click', (event) => {
      const hit = (event.target as Element | null)?.closest?.('.line__hit')
      const slug = hit ? lineOf(hit) : null
      if (!slug || !map) return
      map
        .querySelector<HTMLAnchorElement>(`.term[data-line="${CSS.escape(slug)}"] .term__name`)
        ?.click()
    })
    map?.classList.add('is-live')
    cleanups.push(() => {
      map?.classList.remove('is-live')
      lit(null)
    })

    // ── when trains run ─────────────────────────────────────────────────
    if (map) {
      // The map is below the hero's screen, and CSS began its opening when the page arrived, where
      // nobody could see it. So it starts over and waits at its first frame until the map comes
      // into view. Only while the map is still below the window: nothing seen is ever hidden. If it
      // is already in view (a short hero, a restored scroll), the opening plays as it began.
      let held: Animation[] = []
      if (
        !reduce.matches &&
        !map.classList.contains('is-settled') &&
        map.getBoundingClientRect().top >= innerHeight
      ) {
        // Settled, the opening's animations are gone; unsettled again, they are made anew.
        map.classList.add('is-settled')
        finite(map)
        map.classList.remove('is-settled')
        held = finite(map)
        held.forEach((animation) => animation.pause())
        const play = () => {
          for (const animation of held) if (animation.playState === 'paused') animation.play()
          held = []
        }
        const arrive = new IntersectionObserver(
          (entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return
            arrive.disconnect()
            play()
          },
          { rootMargin: `0px 0px -${Math.round((1 - OPENING_AT) * 100)}% 0px` },
        )
        arrive.observe(map)
        cleanups.push(() => {
          arrive.disconnect()
          play()
        })
      }

      startTrains()
      // Once the opening is over, a layout that appears later (the window crossing the phone
      // width) shows the map at once rather than drawing it again.
      let mounted = true
      cleanups.push(() => {
        mounted = false
      })
      Promise.all(finite(map).map((animation) => animation.finished.catch(() => undefined))).then(
        // Not for an island that has gone: its opening was cut short, not played out.
        () => mounted && map.classList.add('is-settled'),
      )

      const seen = new IntersectionObserver((entries) => {
        onScreen = entries.some((entry) => entry.isIntersecting)
        setRunning()
      })
      seen.observe(map)
      let shown: SVGSVGElement | null = shownSvg(map)
      const resized = new ResizeObserver(() => {
        const now = shownSvg(map)
        if (now !== shown) {
          shown = now
          startTrains()
        }
      })
      resized.observe(map)
      const visibility = () => setRunning()
      document.addEventListener('visibilitychange', visibility)
      const motionChanged = () => (reduce.matches ? stopTrains() : startTrains())
      reduce.addEventListener('change', motionChanged)
      cleanups.push(() => {
        seen.disconnect()
        resized.disconnect()
        document.removeEventListener('visibilitychange', visibility)
        reduce.removeEventListener('change', motionChanged)
        stopTrains()
      })
    }

    // ── the board's rows sweep in ───────────────────────────────────────
    if (board && !reduce.matches) {
      if (board.getBoundingClientRect().top >= innerHeight) {
        // Below the fold, so nobody has seen it yet: the rows wait out of sight, then arrive.
        board.classList.add('is-pending')
        const arrive = new IntersectionObserver(
          (entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return
            board.classList.replace('is-pending', 'is-arrived')
            arrive.disconnect()
          },
          { rootMargin: '0px 0px -12% 0px' },
        )
        arrive.observe(board)
        cleanups.push(() => arrive.disconnect())
      } else {
        // Already in view: only the light sweeps across; nothing that was seen is hidden.
        board.classList.add('is-swept')
      }
      cleanups.push(() => board.classList.remove('is-pending', 'is-arrived', 'is-swept'))
    }

    // ── the bands under the board arrive ────────────────────────────────
    if (!reduce.matches) {
      const bands = [
        ...document.querySelectorAll<HTMLElement>(
          '.home > :is(.offer, .works-band, .home__notes, .band)',
        ),
      ].filter((band) => band.getBoundingClientRect().top >= innerHeight)
      if (bands.length > 0) {
        // Below the window, so nobody has seen them yet: each waits, then arrives.
        const arrive = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue
              entry.target.classList.replace('is-pending', 'is-arrived')
              arrive.unobserve(entry.target)
            }
          },
          { rootMargin: '0px 0px -12% 0px' },
        )
        for (const band of bands) {
          band.classList.add('is-pending')
          arrive.observe(band)
        }
        cleanups.push(() => {
          arrive.disconnect()
          bands.forEach((band) => band.classList.remove('is-pending', 'is-arrived'))
        })
      }
    }

    // ── where the visitor is: settling, and the strip map ───────────────
    const root = document.documentElement
    const strip = document.querySelector<HTMLElement>('.strip')
    const links = strip ? [...strip.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')] : []
    const hero = document.querySelector<HTMLElement>('.hero')
    // A stop's section; the first stop is the top of the page, the hero's.
    const sections = links.map((link) => document.getElementById(link.hash.slice(1)) ?? hero)
    // The screens a scroll settles on, with how far under the window's top each comes to rest.
    const screens = reduce.matches
      ? []
      : [...document.querySelectorAll<HTMLElement>('.home > :is(.home__map, .home__board)')].map(
          (el) => ({ el, rest: parseFloat(getComputedStyle(el).scrollMarginTop) || 0 }),
        )
    let here = -1
    // The stop that was clicked stays the one lit, during the ride and until the page is next
    // scrolled: on a tall window its section may come to rest with the next one in view too.
    let chosen = -1
    let riding = false
    let restedAt = 0
    const locate = () => {
      const height = innerHeight
      // Armed while a screen is well below the window's top, let go once it is reached or passed.
      for (const { el, rest } of screens) {
        const top = el.getBoundingClientRect().top
        if (top <= rest + 2) el.classList.remove('is-next')
        else if (top >= height * SETTLE_FROM) el.classList.add('is-next')
      }
      if (!strip) return
      if (chosen >= 0 && !riding && Math.abs(scrollY - restedAt) > 4) chosen = -1
      const left = root.scrollHeight - height - scrollY
      const line = height * (1 - (1 - HERE_AT) * Math.min(1, Math.max(0, left / height)))
      let now = 0
      sections.forEach((section, i) => {
        if (section && section.getBoundingClientRect().top <= line) now = i
      })
      if (chosen >= 0) now = chosen
      if (now === here) return
      here = now
      strip.style.setProperty('--at', String(now))
      links.forEach((link, i) => {
        link.parentElement?.classList.toggle('is-passed', i < now)
        if (i === now) link.setAttribute('aria-current', 'location')
        else link.removeAttribute('aria-current')
      })
    }
    if (strip || screens.length > 0) {
      // One reading per frame while the page is scrolling or resizing, and none otherwise.
      let frame = 0
      const moved = () => {
        frame ||= requestAnimationFrame(() => {
          frame = 0
          locate()
        })
      }
      locate()
      if (screens.length > 0) root.classList.add('is-settling')
      strip?.classList.add('is-live')
      addEventListener('scroll', moved, { passive: true })
      addEventListener('resize', moved)
      cleanups.push(() => {
        cancelAnimationFrame(frame)
        removeEventListener('scroll', moved)
        removeEventListener('resize', moved)
        root.classList.remove('is-settling')
        screens.forEach(({ el }) => el.classList.remove('is-next'))
        strip?.classList.remove('is-live')
        strip?.style.removeProperty('--at')
        links.forEach((link) => {
          link.parentElement?.classList.remove('is-passed')
          link.removeAttribute('aria-current')
        })
      })
    }
    // A click on a stop rides there: the browser's own jump to the section, made smooth for as
    // long as the ride takes (never under reduced motion: the design system forbids it there).
    let ride = 0
    listen(strip, 'click', (event) => {
      const link = (event.target as Element | null)?.closest?.('a[href^="#"]')
      if (!link) return
      chosen = links.indexOf(link as HTMLAnchorElement)
      riding = true
      locate()
      root.classList.add('is-travelling')
      clearTimeout(ride)
      ride = window.setTimeout(() => {
        root.classList.remove('is-travelling')
        riding = false
        restedAt = scrollY
      }, 1200)
    })
    cleanups.push(() => {
      clearTimeout(ride)
      root.classList.remove('is-travelling')
    })

    return () => cleanups.forEach((cleanup) => cleanup())
  }, [])

  return null
}
