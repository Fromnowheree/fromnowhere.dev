#!/usr/bin/env node
// Replaces the default password of Umami's built-in admin account (admin / umami) with a
// generated one, printed ONCE on this terminal and stored nowhere else (decision 24: when
// statistics are on, their credentials are generated at installation). Run at provisioning,
// before STATS_DOMAIN publishes the dashboard, through scripts/stats-admin.sh, which feeds this
// file to Node inside the Umami container: Umami's image has Node but none of this repository.
//
// It talks to Umami's own API on the container's port: sign in with the default password, change
// it, then sign in with the new one to prove it took. Once the default password no longer works
// it refuses, so it can never replace a password someone already chose.
//
// Plain JavaScript with no dependencies, so it runs in Umami's image as it is.

import { randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'

export const DEFAULT_USERNAME = 'admin'
export const DEFAULT_PASSWORD = 'umami'

/** 24 random bytes as URL-safe base64: 32 characters, nothing a shell or a form mangles. */
export const generatePassword = () => randomBytes(24).toString('base64url')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const post = (url, body, token) =>
  fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })

/** Signs in; the session token, or null when Umami refuses the password. */
const signIn = async (base, password) => {
  const response = await post(`${base}/api/auth/login`, {
    username: DEFAULT_USERNAME,
    password,
  })
  if (response.status === 401) return null
  if (!response.ok) throw new Error(`Umami answered ${response.status} to the sign-in.`)
  const { token } = await response.json()
  if (!token) throw new Error('Umami signed in but returned no session.')
  return token
}

/** Waits up to `seconds` for Umami to answer, since it migrates its database before it serves. */
const waitForUmami = async (base, seconds) => {
  for (let waited = 0; ; waited += 2) {
    try {
      if ((await fetch(`${base}/api/heartbeat`)).ok) return
    } catch {
      // Not listening yet.
    }
    if (waited >= seconds) throw new Error(`Umami did not answer at ${base} within ${seconds}s.`)
    await sleep(2000)
  }
}

/**
 * Replaces the default admin password. Returns `{ status: 'replaced', password }`, or
 * `{ status: 'already-replaced' }` when the default password no longer signs in (nothing changed).
 */
export const replaceDefaultPassword = async ({
  base,
  password = generatePassword(),
  waitSeconds = 60,
}) => {
  await waitForUmami(base, waitSeconds)
  const token = await signIn(base, DEFAULT_PASSWORD)
  if (!token) return { status: 'already-replaced' }

  const response = await post(
    `${base}/api/me/password`,
    { currentPassword: DEFAULT_PASSWORD, newPassword: password },
    token,
  )
  if (!response.ok) throw new Error(`Umami answered ${response.status}; the password is unchanged.`)
  if (!(await signIn(base, password))) {
    throw new Error('Umami accepted the change but the new password does not sign in.')
  }
  return { status: 'replaced', password }
}

const fail = (message) => {
  process.stderr.write(`stats-admin: ${message}\n`)
  process.exit(1)
}

const main = async () => {
  const base = `http://127.0.0.1:${process.env.PORT || '3000'}`
  const result = await replaceDefaultPassword({ base })
  if (result.status === 'already-replaced') {
    fail(
      "refused: Umami's admin no longer has the default password, so it was changed already. " +
        'Reset it in the Umami dashboard if it is lost.',
    )
  }
  process.stdout.write(
    [
      '',
      "Umami's admin password replaced.",
      `  Username: ${DEFAULT_USERNAME}`,
      `  Password: ${result.password}`,
      '',
      'This password is shown once and stored nowhere else. Keep it where you keep your',
      'other credentials. The dashboard can now be published: set STATS_DOMAIN in .env.',
      '',
    ].join('\n'),
  )
}

// Run as a script: from a file, or from standard input (`node --input-type=module -`, which is
// how scripts/stats-admin.sh runs it). Tests import the helpers above.
const entry = process.argv[1]
if (entry === '-' || (entry && import.meta.url === pathToFileURL(entry).href)) {
  main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
}
