import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { MAP, routeMap, type LineState } from '@/lib/routeMap'
import { CARD_PALETTE, cardLineColour, shareCardSize } from '@/lib/shareCard'

// Bundled with the app (src/assets/fonts, SIL OFL), so rendering never fetches from the network.
// Satori reads TTF but not WOFF2, so this is a TTF copy of the site's Inter. Regular only: the
// brand never goes heavier than 500, and at card sizes 400 carries the hierarchy by size alone.
const fontsDir = join(process.cwd(), 'src/assets/fonts')
const interRegular = await readFile(join(fontsDir, 'Inter-Regular.ttf'))
const fonts = [
  { name: 'Inter', data: interRegular, weight: 400 as const, style: 'normal' as const },
]

const P = CARD_PALETTE

/** One line of the map on a card: its number, how it is drawn, and whether it is lit. */
export type CardLine = { line: number; state: LineState; stops: number; lit: boolean }

/** Shorter titles get bigger type; the title has the left half of the card. */
const titleSize = (title: string) =>
  title.length <= 18 ? 72 : title.length <= 32 ? 60 : title.length <= 56 ? 50 : 42

/** Four lines hold ~100 characters at the smallest size; cut longer titles between words. */
const fitTitle = (title: string) =>
  title.length <= 100
    ? title
    : `${title.slice(0, title.lastIndexOf(' ', 96)).replace(/[\s,:;–-]+$/, '')}…`

/** The map's box on the card: the right side, the lines' terminals near its right edge. */
const BOX = { left: 548, top: 36, width: 616, height: 558 }

/**
 * The route map as one SVG, cropped just past the terminals (the labels are the site's HTML and
 * have no place here). Lit lines carry their colour, a glow and a train; the others stay as
 * faint tracks, so a project's card shows its own line leaving the point among the rest.
 */
function CardMap({ lines }: { lines: CardLine[] }) {
  const geometry = routeMap(lines.map(({ state, stops }) => ({ state, stops })))
  if (!geometry) return null
  const map = geometry.wide
  const L = MAP.wide
  const cropWidth = L.terminalX + L.terminal * 3
  const scale = Math.min(BOX.width / cropWidth, BOX.height / map.height)
  const width = Math.round(cropWidth * scale)
  const height = Math.round(map.height * scale)
  const { x: ox, y: oy } = map.origin

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${cropWidth} ${map.height}`}
      style={{
        position: 'absolute',
        left: BOX.left + (BOX.width - width),
        top: BOX.top + Math.round((BOX.height - height) / 2),
      }}
    >
      {map.lines.map((line, i) => (
        <path
          key={`casing-${i}`}
          d={line.d}
          fill="none"
          stroke={P.track}
          strokeWidth={L.stroke + 6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {map.lines.map((line, i) => {
        const { lit, state } = lines[i]
        const colour = cardLineColour(lines[i].line)
        const built = line.built ? `${line.built.length} ${line.length}` : undefined
        const rest = line.built?.dashes ?? line.dashes
        const { x, y } = line.terminal
        const opacity = lit ? 1 : 0.24
        const trainAt = (line.built?.length ?? line.length) * 0.62
        return (
          <g key={`line-${i}`} opacity={opacity}>
            {lit && state !== 'planned' && (
              <path
                d={line.d}
                fill="none"
                stroke={colour}
                strokeOpacity={0.28}
                strokeWidth={L.stroke * 3.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={built}
              />
            )}
            {state !== 'planned' && (
              <path
                d={line.d}
                fill="none"
                stroke={colour}
                strokeWidth={L.stroke}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={built}
              />
            )}
            {rest && (
              <path
                d={line.d}
                fill="none"
                stroke={colour}
                strokeOpacity={0.6}
                strokeWidth={L.stroke * 0.6}
                strokeDasharray={rest}
              />
            )}
            {line.stops.map((stop) => (
              <circle
                key={`${stop.x} ${stop.y}`}
                cx={stop.x}
                cy={stop.y}
                r={L.stroke * 0.95}
                fill={P.ground}
                stroke={colour}
                strokeWidth={L.stroke * 0.55}
              />
            ))}
            {lit && state !== 'planned' && (
              <>
                <path
                  d={line.d}
                  fill="none"
                  stroke={colour}
                  strokeOpacity={0.55}
                  strokeWidth={L.stroke * 2.4}
                  strokeLinecap="round"
                  strokeDasharray={`${L.train} ${Math.ceil(line.length * 2)}`}
                  strokeDashoffset={-trainAt}
                />
                <path
                  d={line.d}
                  fill="none"
                  stroke={P.trainCore}
                  strokeWidth={L.stroke * 0.9}
                  strokeLinecap="round"
                  strokeDasharray={`${L.train} ${Math.ceil(line.length * 2)}`}
                  strokeDashoffset={-trainAt}
                />
              </>
            )}
            {lit && <circle cx={x} cy={y} r={L.terminal * 2.6} fill={colour} fillOpacity={0.16} />}
            <circle
              cx={x}
              cy={y}
              r={L.terminal}
              fill={P.ground}
              stroke={colour}
              strokeWidth={L.stroke * 0.75}
              strokeDasharray={state === 'building' || state === 'planned' ? '5 5' : undefined}
            />
            {state === 'running' && <circle cx={x} cy={y} r={L.terminal * 0.38} fill={colour} />}
          </g>
        )
      })}
      <circle cx={ox} cy={oy} r={64} fill={P.accent} fillOpacity={0.12} />
      <circle cx={ox} cy={oy} r={34} fill={P.accent} fillOpacity={0.2} />
      <circle cx={ox} cy={oy} r={12} fill={P.accent} />
      <circle cx={ox} cy={oy} r={4.5} fill={P.trainCore} />
    </svg>
  )
}

/**
 * The card for a shared link, drawn from the route map: the studio's mark top left, the page's
 * kicker and title on the left, and on the right the map's lines leaving the point. A project's
 * card lights its own line (in its colour, with a train on it) and leaves the others faint; every
 * other page lights them all.
 */
export function renderShareCard({
  title,
  kicker,
  domain,
  lines,
  accent,
}: {
  title: string
  kicker: string
  domain: string
  /** The published projects in line order; empty draws no map. */
  lines: CardLine[]
  /** The kicker's colour: the project's line, or the point's violet. */
  accent?: string
}) {
  title = fitTitle(title)
  const plate = (left: number, top: number, width: number, height: number) => (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        borderRadius: 2,
        backgroundColor: P.text,
      }}
    />
  )
  const mark = accent ?? P.accent
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        backgroundColor: P.night,
        backgroundImage: [
          'radial-gradient(ellipse 70% 80% at 18% 8%, rgba(120, 100, 255, 0.22), rgba(5, 6, 15, 0) 70%)',
          'radial-gradient(ellipse 90% 50% at 50% 115%, rgba(255, 160, 60, 0.12), rgba(5, 6, 15, 0) 70%)',
        ].join(', '),
        fontFamily: 'Inter',
        color: P.text,
      }}
    >
      <CardMap lines={lines} />

      {/* The monogram on its tile: 64-unit geometry at 1.0 (design/logo.md). */}
      <div
        style={{
          position: 'absolute',
          left: 72,
          top: 64,
          width: 86,
          height: 86,
          borderRadius: 15,
          backgroundColor: P.surface2,
          display: 'flex',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 11,
            top: 11,
            width: 64,
            height: 64,
            display: 'flex',
          }}
        >
          {plate(14, 10, 11, 44)}
          {plate(29, 10, 23, 11)}
          {plate(29, 29, 17, 11)}
          <div
            style={{
              position: 'absolute',
              left: 29,
              top: 43,
              width: 11,
              height: 11,
              borderRadius: 999,
              backgroundColor: P.accent,
            }}
          />
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 178,
          top: 88,
          fontSize: 34,
          letterSpacing: 2.4,
          display: 'flex',
        }}
      >
        FNW
      </div>

      <div
        style={{
          position: 'absolute',
          left: 72,
          width: 456,
          top: 196,
          bottom: 116,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 18,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontSize: 22,
            letterSpacing: 2.6,
            color: P.muted,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              backgroundColor: mark,
              boxShadow: `0 0 14px ${mark}`,
            }}
          />
          {kicker.toUpperCase()}
        </div>
        <div
          style={{
            fontSize: titleSize(title),
            lineHeight: 1.06,
            letterSpacing: -1.5,
            display: 'flex',
          }}
        >
          {title}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 72,
          bottom: 56,
          fontSize: 24,
          letterSpacing: 0.5,
          color: P.dim,
          display: 'flex',
        }}
      >
        {domain}
      </div>
    </div>,
    { ...shareCardSize, fonts },
  )
}
