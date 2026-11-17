import type { Access } from 'payload'

/**
 * Only a signed-in editor. The site reads its content through the Local API
 * (src/lib/payload.ts), never over HTTP, so the REST API answers a visitor 403 for every
 * collection and the studio's settings: there is nothing there a visitor needs.
 */
export const signedIn: Access = ({ req }) => Boolean(req.user)
