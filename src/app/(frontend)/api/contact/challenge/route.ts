import { getPayloadClient } from '@/lib/payload'
import { clientAddress, warnIfInternalAddress } from '@/lib/rateLimit'
import { relayReady } from '@/lib/relay/config'
import { challengeLimiter } from '@/lib/relay/limits'
import { createProofChallenge } from '@/lib/relay/proof'

// A fresh puzzle on every request; never cached by Next or by anything in between.
export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

/**
 * The proof-of-work challenge for the contact form (src/lib/relay/proof.ts), fetched by the
 * ALTCHA widget in the visitor's browser. It sits beside Payload's REST routes under /api; a
 * static route wins over Payload's catch-all, and tests/e2e/api.e2e.spec.ts holds that it is
 * reachable. Without the relay there is no form, so there is no challenge either (503).
 */
export async function GET(request: Request) {
  if (!relayReady()) {
    return Response.json(
      { error: 'the contact form is not set up' },
      { status: 503, headers: noStore },
    )
  }
  const address = clientAddress(request.headers)
  warnIfInternalAddress(address, (text) => void getPayloadClient().then((p) => p.logger.warn(text)))
  if (!challengeLimiter.allow(address, Date.now())) {
    return Response.json({ error: 'too many requests' }, { status: 429, headers: noStore })
  }
  const challenge = await createProofChallenge()
  if (!challenge) {
    return Response.json(
      { error: 'the contact form is not set up' },
      { status: 503, headers: noStore },
    )
  }
  return Response.json(challenge, { headers: noStore })
}
