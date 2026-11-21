/**
 * PAYLOAD_SECRET signs the editor's session, and the contact form's keys and the provisioning
 * token are derived from it (src/lib/relay/keys.ts, src/lib/provision.ts). Compose refuses an
 * empty one; this refuses one that could be guessed, so a placeholder or a word typed by hand
 * never reaches production. `.env.example` asks for `openssl rand -hex 32`, which is 64 characters.
 */
export const MIN_SECRET_LENGTH = 32

/** Why this secret must not be used in production, or null when it may. */
export const weakSecret = (secret: string | undefined): string | null => {
  if (!secret) return 'it is not set'
  if (secret.length < MIN_SECRET_LENGTH) return `it is shorter than ${MIN_SECRET_LENGTH} characters`
  if (new Set(secret).size < 8) return 'it repeats only a few characters'
  return null
}
