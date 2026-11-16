import { getPayload } from 'payload'

import config from '@payload-config'

// Asked every few seconds by the container's health check; never cached.
export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

/**
 * The container health check (compose.yml): 200 once Payload has started (production migrations
 * included, src/instrumentation.ts) and the database answers a query, 503 otherwise. It says
 * nothing about the content. A static route beside Payload's /api catch-all, like the contact
 * form's challenge route.
 */
export async function GET() {
  try {
    const payload = await getPayload({ config })
    await payload.count({ collection: 'users', overrideAccess: true })
    return Response.json({ status: 'ok' }, { headers: noStore })
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers: noStore })
  }
}
