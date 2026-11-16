#!/usr/bin/env node
// Creates the site's first admin account: the e-mail from ADMIN_EMAIL, a generated password
// printed ONCE on this terminal and stored nowhere else. Run inside the app container, at
// provisioning, through scripts/create-admin.sh:
//
//   ./scripts/create-admin.sh
//
// It calls Payload's first-register endpoint on the container's own port, with the token from
// src/lib/provision.ts (derived here the same way, because the runner image has no TypeScript).
// Payload refuses once any user exists, so it can never replace or add an admin later; further
// accounts are made in the admin panel by a signed-in admin.
//
// Plain JavaScript with no dependencies, so it runs in the production image as it is.

import { createHmac, randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'

export const PROVISION_HEADER = 'x-provision-token'
const PROVISION_LABEL = 'fromnowhere-web/first-admin/v1'

/** The same derivation as provisionToken() in src/lib/provision.ts. */
export const provisionToken = (secret) =>
  createHmac('sha256', secret).update(PROVISION_LABEL).digest('hex')

/** 24 random bytes as URL-safe base64: 32 characters, nothing a shell or a form mangles. */
export const generatePassword = () => randomBytes(24).toString('base64url')

// One plain address; Payload validates it again.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const fail = (message) => {
  process.stderr.write(`create-admin: ${message}\n`)
  process.exit(1)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** POSTs to first-register, waiting up to a minute for a server that is still starting. */
const register = async (url, headers, body) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url, { method: 'POST', headers, body })
    } catch (error) {
      if (attempt >= 30) throw error
      await sleep(2000)
    }
  }
}

const main = async () => {
  const email = process.env.ADMIN_EMAIL?.trim() ?? ''
  const secret = process.env.PAYLOAD_SECRET ?? ''
  const port = process.env.PORT || '3000'
  if (!EMAIL.test(email)) fail('set ADMIN_EMAIL in .env to the first admin’s e-mail address.')
  if (!secret) fail('PAYLOAD_SECRET is not set in the container.')

  const password = generatePassword()
  const response = await register(
    `http://127.0.0.1:${port}/api/users/first-register`,
    {
      'content-type': 'application/json',
      [PROVISION_HEADER]: provisionToken(secret),
    },
    JSON.stringify({ email, password, name: 'Admin' }),
  )

  if (response.status === 403) {
    fail('refused: an account already exists. Sign in at /admin, or reset the password there.')
  }
  if (!response.ok) fail(`the server answered ${response.status}; nothing was created.`)

  process.stdout.write(
    [
      '',
      'First admin created.',
      `  E-mail:   ${email}`,
      `  Password: ${password}`,
      '',
      'This password is shown once and stored nowhere else. Hand it over now, and change it',
      'after the first sign-in (Account, in the admin panel).',
      '',
    ].join('\n'),
  )
}

// Only when run as a script; tests import the two helpers above.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
}
