import { serverUrl } from './serverUrl'

/**
 * The origins Payload accepts the editor's session cookie from (`csrf` in src/payload.config.ts):
 * the site's own address, and in development the dev server on localhost as well.
 *
 * The list must never be empty. With no list Payload accepts the cookie from ANY origin, and a
 * SameSite=Lax cookie is still sent with a form posted from another subdomain of the same site
 * (book.<domain>, stats.<domain>). A page there could then create an admin account or rewrite
 * content while an editor is signed in. tests/int/csrf.int.spec.ts holds this.
 */
export const siteOrigins = (): string[] => {
  const origins = new Set([new URL(serverUrl).origin])
  if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || '3000'
    origins.add(`http://localhost:${port}`)
    origins.add(`http://127.0.0.1:${port}`)
  }
  return [...origins]
}
