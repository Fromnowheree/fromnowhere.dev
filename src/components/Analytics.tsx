import Script from 'next/script'

import { serverUrl } from '@/lib/serverUrl'
import { StatsClicks } from './StatsClicks'

/**
 * Where the statistics script is and which website it counts, or null when visitor statistics
 * are off. Decision 24: off by default, so it takes BOTH the studio's setting (Studio →
 * Statistics) and the installer's environment (UMAMI_SCRIPT_URL, UMAMI_WEBSITE_ID), read per
 * request so neither needs a rebuild. Without either there is no script and no request to a
 * statistics route at all.
 */
export const statisticsScript = (
  enabled: boolean | null | undefined,
  env: Record<string, string | undefined> = process.env,
): { src: string; websiteId: string } | null => {
  const src = env.UMAMI_SCRIPT_URL?.trim()
  const websiteId = env.UMAMI_WEBSITE_ID?.trim()
  return enabled === true && src && websiteId ? { src, websiteId } : null
}

/** Cookieless visitor statistics (self-hosted Umami). The admin has its own layout and never
 * loads it. */
export function Analytics({
  enabled,
  nonce,
}: {
  enabled: boolean | null | undefined
  /** The request's script nonce (src/lib/csp.ts): without it the policy stops the script. */
  nonce?: string
}) {
  const script = statisticsScript(enabled)
  if (!script) return null

  return (
    <>
      <Script
        src={script.src}
        data-website-id={script.websiteId}
        // Count only the real domain, not visits to a preview, the server IP or localhost.
        data-domains={new URL(serverUrl).hostname}
        strategy="afterInteractive"
        nonce={nonce}
      />
      <StatsClicks />
    </>
  )
}
