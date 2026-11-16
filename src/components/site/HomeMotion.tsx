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
 * - trains, one Web Animation each, running along their line after it is drawn, with an arrival
 *   pulse at the terminal; paused while the tab is hidden or the map is off screen;
 * - lighting: pointing at or focusing a line, its terminal or its board row lights that line on
 *   the map and the board, dims the others and speeds its trains up;
 * - the board's rows sweeping in as it comes into view.
 *
 * Nothing here hides content that was already on screen, and under reduced motion it adds only
 * the lighting.
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
        const opening = line.group
          .getAnimations({ subtree: true })
          .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        Promise.all(opening.map((animation) => animation.finished.catch(() => undefined))).then(
          () => {
            if (generation === started) runTrains(line)
          },
        )
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
      startTrains()
      // Once the opening is over, a layout that appears later (the window crossing the phone
      // width) shows the map at once rather than drawing it again.
      const opening = map
        .getAnimations({ subtree: true })
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
      Promise.all(opening.map((animation) => animation.finished.catch(() => undefined))).then(() =>
        map.classList.add('is-settled'),
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

    return () => cleanups.forEach((cleanup) => cleanup())
  }, [])

  return null
}
