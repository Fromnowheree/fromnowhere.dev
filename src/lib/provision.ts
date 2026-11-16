import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * The first admin is created at provisioning, never by whoever opens /admin first.
 *
 * Payload offers a "create first user" form (POST /api/users/first-register) for as long as the
 * users table is empty, to anyone who can reach the site. That window opens on every fresh
 * install, between the container starting and someone signing in. So the endpoint only accepts a
 * request that carries this token, which is derived from PAYLOAD_SECRET and so known only to
 * something that can read the server's environment: `scripts/create-admin.mjs`, run inside the
 * app container by `scripts/create-admin.sh`. Caddy also refuses the path from outside.
 *
 * `scripts/create-admin.mjs` derives the same value by itself (the runner image has no
 * TypeScript); tests/int/provision.int.spec.ts holds the two equal.
 */
export const PROVISION_HEADER = 'x-provision-token'

const PROVISION_LABEL = 'fromnowhere-web/first-admin/v1'

/** The token for this secret, or null without one (then nothing is accepted). */
export const provisionToken = (secret: string | undefined): string | null =>
  secret ? createHmac('sha256', secret).update(PROVISION_LABEL).digest('hex') : null

/** Whether these request headers carry the right token, compared in constant time. */
export const carriesProvisionToken = (
  headers: Headers | undefined,
  secret: string | undefined = process.env.PAYLOAD_SECRET,
): boolean => {
  const expected = provisionToken(secret)
  const given = headers?.get(PROVISION_HEADER)
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
