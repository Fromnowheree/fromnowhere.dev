import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_PASSWORD,
  DEFAULT_USERNAME,
  generatePassword,
  replaceDefaultPassword,
} from '../../scripts/stats-admin.mjs'

/**
 * scripts/stats-admin.mjs against a stand-in for Umami's API: the three calls it makes, answered
 * the way Umami 3.4 answers them (checked against the real image at the time of writing).
 */

let server: Server
let base = ''
let password = DEFAULT_PASSWORD
let sessions = new Set<string>()

const body = async (request: IncomingMessage) => {
  let text = ''
  for await (const chunk of request) text += chunk
  return JSON.parse(text || '{}') as Record<string, string>
}

beforeAll(async () => {
  server = createServer(async (request, response) => {
    const answer = (status: number, json: unknown) => {
      response.writeHead(status, { 'content-type': 'application/json' })
      response.end(JSON.stringify(json))
    }
    if (request.url === '/api/heartbeat') return answer(200, { ok: true })
    if (request.url === '/api/auth/login' && request.method === 'POST') {
      const { username, password: given } = await body(request)
      if (username !== DEFAULT_USERNAME || given !== password) return answer(401, { error: {} })
      const token = `session-${sessions.size + 1}`
      sessions.add(token)
      return answer(200, { token, user: { username } })
    }
    if (request.url === '/api/me/password' && request.method === 'POST') {
      const token = request.headers.authorization?.replace(/^Bearer /, '') ?? ''
      if (!sessions.has(token)) return answer(401, { error: {} })
      const { currentPassword, newPassword } = await body(request)
      if (currentPassword !== password || !newPassword) return answer(400, { error: {} })
      password = newPassword
      return answer(200, { username: DEFAULT_USERNAME })
    }
    answer(404, {})
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

beforeEach(() => {
  password = DEFAULT_PASSWORD
  sessions = new Set()
})

describe("Umami's admin at provisioning", () => {
  it('no longer signs in with the default password, only with the generated one', async () => {
    const result = await replaceDefaultPassword({ base, waitSeconds: 0 })
    expect(result.status).toBe('replaced')
    expect(password).not.toBe(DEFAULT_PASSWORD)
    expect(password).toBe(result.password)
  })

  it('is never changed twice: a password already replaced is left alone', async () => {
    password = 'chosen-by-the-owner'
    expect(await replaceDefaultPassword({ base, waitSeconds: 0 })).toEqual({
      status: 'already-replaced',
    })
    expect(password).toBe('chosen-by-the-owner')
  })

  it('gets a long random password', () => {
    const a = generatePassword()
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(generatePassword()).not.toBe(a)
  })
})
