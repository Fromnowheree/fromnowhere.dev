'use client'

/**
 * The last resort: an error in a root layout itself ([locale]/layout.tsx, or the editor's), where
 * no stylesheet, font or message has loaded. Its own document, in both languages, in the night's
 * colours written out (site.css's --night, --text, --text-muted, --sodium), with Try again and the
 * way home. Next's own 500 page is never shown.
 */
const night = '#05060f'
const text = '#eeedf6'
const muted = '#a8acc6'
const sodium = '#ffb347'

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  const button = {
    minHeight: 44,
    padding: '10px 18px',
    borderRadius: 999,
    font: 'inherit',
    fontWeight: 500,
    cursor: 'pointer',
  } as const
  return (
    <html lang="en" style={{ background: night, colorScheme: 'dark' }}>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background: night,
          color: text,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          lineHeight: 1.55,
        }}
      >
        <title>Service interrupted · Fromnowhere</title>
        <main
          style={{
            maxWidth: 720,
            margin: '0 auto',
            padding: '64px 16px',
            display: 'grid',
            gap: 18,
          }}
        >
          <div
            aria-hidden="true"
            style={{ width: 160, height: 5, borderRadius: 3, background: sodium, opacity: 0.85 }}
          />
          <h1 style={{ margin: 0, fontWeight: 500, fontSize: 40, lineHeight: 1.1 }}>
            Service interrupted
          </h1>
          <p style={{ margin: 0, color: muted, fontSize: 18 }}>
            Something went wrong on this line. Try again, or go back to the start.
          </p>
          <p lang="hr" style={{ margin: 0, color: muted, fontSize: 18 }}>
            Nešto je pošlo po krivu na ovoj liniji. Pokušajte ponovno ili se vratite na početak.
          </p>
          <p style={{ margin: 0, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{ ...button, border: 0, background: text, color: night }}
            >
              Try again · Pokušaj ponovno
            </button>
            {/* A plain link: the router itself may be what failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                ...button,
                display: 'inline-flex',
                alignItems: 'center',
                border: `1px solid ${muted}`,
                color: text,
                textDecoration: 'none',
              }}
            >
              Back to the start · Natrag na početak
            </a>
          </p>
        </main>
      </body>
    </html>
  )
}
