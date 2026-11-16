import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { shareCardSize } from '@/lib/shareCard'

// Bundled with the app (src/assets/fonts, SIL OFL), so rendering never fetches from the network.
// Satori reads TTF but not WOFF2, so this is a TTF copy of the site's Inter. Regular only: the
// brand never goes heavier than 500, and at card sizes 400 carries the hierarchy by size alone.
const fontsDir = join(process.cwd(), 'src/assets/fonts')
const interRegular = await readFile(join(fontsDir, 'Inter-Regular.ttf'))
const fonts = [
  { name: 'Inter', data: interRegular, weight: 400 as const, style: 'normal' as const },
]

// The dark theme's tokens (src/styles/fnw/tokens.css): dark is the brand's primary theme.
const ground = '#161826'
const surface = '#232532'
const text = '#e9e9ed'
const muted = '#b2b6ca'
const accent = '#9184d9'
const route = '#595d6c'

/** Shorter titles get bigger type. */
const titleSize = (title: string) =>
  title.length <= 24 ? 76 : title.length <= 40 ? 64 : title.length <= 60 ? 56 : 48

/** Three lines hold ~100 characters at the smallest size; cut longer titles between words. */
const fitTitle = (title: string) =>
  title.length <= 100
    ? title
    : `${title.slice(0, title.lastIndexOf(' ', 96)).replace(/[\s,:;–-]+$/, '')}…`

/**
 * The card for a shared link, drawn as the route map in miniature: the point on the left, a line
 * leaving it, and the page's title where the line arrives. The monogram's plates sit top left.
 */
export function renderShareCard({
  title,
  kicker,
  domain,
}: {
  title: string
  kicker: string
  domain: string
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
        backgroundColor: text,
      }}
    />
  )
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        backgroundColor: ground,
        backgroundImage: `radial-gradient(circle at 0% 0%, ${surface}, ${ground} 70%)`,
        fontFamily: 'Inter',
        color: text,
      }}
    >
      {/* The monogram on its tile: 64-unit geometry at 1.25 (design/logo.md). */}
      <div
        style={{
          position: 'absolute',
          left: 72,
          top: 64,
          width: 107,
          height: 107,
          borderRadius: 19,
          backgroundColor: surface,
          display: 'flex',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 13,
            top: 13,
            width: 80,
            height: 80,
            display: 'flex',
          }}
        >
          {plate(17.5, 12.5, 13.75, 55)}
          {plate(36.25, 12.5, 28.75, 13.75)}
          {plate(36.25, 36.25, 21.25, 13.75)}
          <div
            style={{
              position: 'absolute',
              left: 36.25,
              top: 53.75,
              width: 13.75,
              height: 13.75,
              borderRadius: 999,
              backgroundColor: accent,
            }}
          />
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 200,
          top: 98,
          fontSize: 40,
          letterSpacing: 2.4,
          display: 'flex',
        }}
      >
        FNW
      </div>

      {/* The point and the line leaving it. */}
      <div
        style={{
          position: 'absolute',
          left: 72,
          top: 330,
          width: 36,
          height: 36,
          borderRadius: 999,
          backgroundColor: accent,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 108,
          top: 346,
          width: 120,
          height: 5,
          borderRadius: 3,
          backgroundColor: route,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 260,
          right: 72,
          top: 250,
          bottom: 120,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <div style={{ fontSize: 24, letterSpacing: 2.4, color: muted, display: 'flex' }}>
          {kicker.toUpperCase()}
        </div>
        <div
          style={{
            fontSize: titleSize(title),
            lineHeight: 1.08,
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
          fontSize: 26,
          color: muted,
          display: 'flex',
        }}
      >
        {domain}
      </div>
    </div>,
    { ...shareCardSize, fonts },
  )
}
