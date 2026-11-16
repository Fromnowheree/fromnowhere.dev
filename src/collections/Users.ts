import { APIError, Forbidden, type CollectionConfig } from 'payload'

import { l, pickLabel } from '../i18n/label'
import { allowAuthRequest } from '../lib/authLimits'
import { carriesProvisionToken } from '../lib/provision'
import { clientAddress } from '../lib/rateLimit'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: l('User', 'Korisnik'), plural: l('Users', 'Korisnici') },
  admin: {
    useAsTitle: 'email',
    group: l('Administration', 'Administracija'),
  },
  auth: {
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
    // The session cookie stays host-only: no `cookies.domain`. A cookie scoped to the parent
    // domain would also be sent to the other *.fromnowhere.dev sites, which must share nothing
    // with this site (decision 12). In production it is Secure, so it never crosses the network
    // in clear text (the site is HTTPS only behind Caddy); development runs on plain
    // http://localhost, where some browsers drop a Secure cookie. SameSite=Lax keeps it off
    // requests other sites start, except a top-level link. tests/int/provision.int.spec.ts holds
    // all three.
    cookies: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
    },
  },
  hooks: {
    beforeOperation: [
      ({ operation, req }) => {
        // Sign-in, "forgot password" and setting a new password, limited per address before
        // Payload counts a wrong password against the account (src/lib/authLimits.ts).
        if (
          req.payloadAPI === 'REST' &&
          (operation === 'login' || operation === 'resetPassword' || operation === 'forgotPassword')
        ) {
          const kind = operation === 'forgotPassword' ? 'forgotPassword' : 'login'
          const address = clientAddress(req.headers)
          // Without Caddy in front (development, the e2e suite) every request shares one key,
          // which a day of test runs would use up; production always has the address.
          const unlimited = address === 'unknown' && process.env.NODE_ENV !== 'production'
          if (!unlimited && !allowAuthRequest(kind, address, Date.now())) {
            throw new APIError(
              pickLabel(req.i18n?.language, {
                en: 'Too many attempts from your connection. Please try again in a few minutes.',
                hr: 'Previše pokušaja s Vaše veze. Pokušajte ponovno za nekoliko minuta.',
              }),
              429,
              undefined,
              true,
            )
          }
        }

        // Over HTTP, a user is created by a signed-in user (Payload's default create access) or,
        // once, by provisioning (src/lib/provision.ts). Payload's own first-register endpoint
        // skips access control, so without this check the first visitor to /admin on a fresh
        // install would become its admin. The Local API (seeds, tests) is not affected.
        if (
          operation === 'create' &&
          req.payloadAPI === 'REST' &&
          !req.user &&
          !carriesProvisionToken(req.headers)
        ) {
          throw new Forbidden(req.t)
        }
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: l('Name', 'Ime'),
    },
  ],
}
