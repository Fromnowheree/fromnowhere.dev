import { readdir, readFile, stat } from 'node:fs/promises'
import { createServer, type Server, type Socket } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { inspect } from 'node:util'

import { solveChallenge, type Challenge } from 'altcha-lib'
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2'
import { headers } from 'next/headers'
import nodemailer from 'nodemailer'
import type Mail from 'nodemailer/lib/mailer'
import MailComposer from 'nodemailer/lib/mail-composer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import { getPayload, type Payload } from 'payload'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as challengeRoute } from '@/app/(frontend)/api/contact/challenge/route'
import { sendInquiry, type InquiryState } from '@/components/contact/actions'
import { locales } from '@/i18n/locales'
import { issueFormToken, MAX_FORM_AGE_MS } from '@/lib/relay/fillTime'
import { createProofChallenge, PROOF_LIFETIME_MS } from '@/lib/relay/proof'
import config from '@/payload.config'
import { seed } from '@/seed'

// The action reads the visitor's address from the request headers; outside a request there are
// none, so each test says which address it comes from.
vi.mock('next/headers', () => ({ headers: vi.fn() }))

let payload: Payload
/** The studio's address, which every refusal gives as the way to write instead. */
const STUDIO_EMAIL = 'studio@example.com'
let savedEmail: string | null | undefined

const RELAY_ENV = {
  CONTACT_SMTP_HOST: 'smtp.example.com',
  CONTACT_SMTP_PORT: '587',
  CONTACT_SMTP_USER: 'website@example.com',
  CONTACT_SMTP_PASS: 'not-a-real-password',
  CONTACT_FROM: 'website@example.com',
  CONTACT_TO: 'studio-inbox@example.com',
}

let address = ''
let addressCounter = 0
/** A fresh visitor address per test, so the module-level rate limit never carries over. */
const newVisitor = () => {
  addressCounter += 1
  address = `198.51.100.${addressCounter}`
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await seed(payload)
  savedEmail = (await payload.findGlobal({ slug: 'studio', depth: 0 })).email
  await payload.updateGlobal({ slug: 'studio', data: { email: STUDIO_EMAIL } })
})

afterAll(async () => {
  await payload.updateGlobal({ slug: 'studio', data: { email: savedEmail ?? null } })
})

/** What the fake mail server received, and how it answers. */
type Delivery = { options: SMTPTransport.Options; mail: Mail.Options; raw: string }
let deliveries: Delivery[] = []
let serverAnswer: 'accept' | 'throw' | 'reject-recipient' = 'accept'

/** The transport, replaced: it builds the real MIME message (nodemailer's own composer) and
 * answers as a server would. Tests that need the real network restore it. */
const fakeTransport = () =>
  vi.spyOn(nodemailer, 'createTransport').mockImplementation(((options: SMTPTransport.Options) => ({
    async sendMail(mail: Mail.Options) {
      const raw = (await new MailComposer(mail).compile().build()).toString('utf8')
      deliveries.push({ options, mail, raw })
      if (serverAnswer === 'throw') {
        // A server reply quoting addresses: none of it may reach a log line.
        throw Object.assign(new Error(`550 5.7.1 <${String(mail.to)}> refused for ${raw}`), {
          code: 'EENVELOPE',
          responseCode: 550,
        })
      }
      if (serverAnswer === 'reject-recipient') return { accepted: [], rejected: [mail.to] }
      return { accepted: [mail.to], rejected: [] }
    },
    close() {},
  })) as unknown as typeof nodemailer.createTransport)

beforeEach(() => {
  Object.assign(process.env, RELAY_ENV)
  deliveries = []
  serverAnswer = 'accept'
  newVisitor()
  vi.mocked(headers).mockImplementation(
    async () => new Headers({ 'x-forwarded-for': address }) as never,
  )
  fakeTransport()
})

afterEach(() => {
  vi.restoreAllMocks()
  for (const name of Object.keys(RELAY_ENV)) delete process.env[name]
})

/** A solved proof of work for a fresh challenge. Small counters keep the search quick; the
 * check that verifies it is the production one. */
const solvedProof = async (challenge?: Challenge | null) => {
  const puzzle = challenge ?? (await createProofChallenge({ counter: [0, 20] }))
  if (!puzzle) throw new Error('no challenge (is PAYLOAD_SECRET set?)')
  const solution = await solveChallenge({ challenge: puzzle, deriveKey })
  return Buffer.from(JSON.stringify({ challenge: puzzle, solution })).toString('base64')
}

type FormFields = Record<string, string | undefined>
/** A form a person filled in ten seconds ago, with a solved proof; `fields` overrides any field
 * (undefined removes it). */
const filledForm = async (fields: FormFields = {}) => {
  const form = new FormData()
  const base: FormFields = {
    locale: 'en',
    name: 'Test Visitor',
    email: 'visitor@example.org',
    message: 'A question about a project.',
    consent: 'on',
    formStarted: issueFormToken(Date.now() - 10_000) ?? '',
  }
  const all = { ...base, ...fields }
  if (!('altcha' in fields)) all.altcha = await solvedProof()
  for (const [key, value] of Object.entries(all)) if (value !== undefined) form.set(key, value)
  return form
}

const send = async (fields: FormFields = {}) =>
  sendInquiry({ status: 'idle' }, await filledForm(fields))

/** Like `send`, from a new visitor: for loops over cases, where the rate limit must not be what
 * refuses. */
const sendAsNewVisitor = async (fields: FormFields = {}) => {
  newVisitor()
  return send(fields)
}

/** The common shape of every refusal: not sent, nothing handed to the mail server, and the
 * studio's address to write to instead. */
const expectRefused = (state: InquiryState) => {
  expect(state.status).toBe('error')
  expect(deliveries).toHaveLength(0)
  if (state.message) expect(state.message).toContain(STUDIO_EMAIL)
  else expect(state.errors).toBeTruthy()
}

/** The header section of a raw message, folded lines joined, as name -> values. */
const headerSection = (raw: string) => {
  const head = raw.split(/\r\n\r\n/)[0]!.replace(/\r\n[ \t]+/g, ' ')
  const map = new Map<string, string[]>()
  for (const line of head.split(/\r\n/)) {
    const colon = line.indexOf(':')
    const name = line.slice(0, colon).toLowerCase()
    map.set(name, [...(map.get(name) ?? []), line.slice(colon + 1).trim()])
  }
  return map
}

describe('a message the mail server accepts', () => {
  it('is reported as sent only once the server accepted it', async () => {
    const state = await send()
    expect(state.status).toBe('success')
    expect(deliveries).toHaveLength(1)
    expect(state.message).toContain('visitor@example.org')
  })

  it('goes from the send-only address to the studio, with Reply-To set to the visitor', async () => {
    await send()
    const head = headerSection(deliveries[0]!.raw)
    expect(head.get('from')?.join()).toContain('<website@example.com>')
    expect(head.get('to')).toEqual(['studio-inbox@example.com'])
    expect(head.get('reply-to')?.join()).toContain('<visitor@example.org>')
    expect(head.has('cc')).toBe(false)
    expect(head.has('bcc')).toBe(false)
  })

  it('travels only over TLS: STARTTLS is required on 587, TLS from the start on 465', async () => {
    await send()
    expect(deliveries[0]!.options).toMatchObject({ port: 587, secure: false, requireTLS: true })
    deliveries = []
    process.env.CONTACT_SMTP_PORT = '465'
    await send()
    expect(deliveries[0]!.options).toMatchObject({ port: 465, secure: true, requireTLS: true })
    expect(deliveries[0]!.options.tls?.rejectUnauthorized).not.toBe(false)
  })

  it('carries what the visitor wrote, and no field the form does not have', async () => {
    await send({ service: 'An invented field', phone: '+1 555 0199' })
    const text = String(deliveries[0]!.mail.text)
    expect(text).toContain('Test Visitor')
    expect(text).toContain('visitor@example.org')
    expect(text).toContain('A question about a project.')
    expect(text).not.toContain('An invented field')
    expect(text).not.toContain('555 0199')
  })
})

describe('header injection', () => {
  const injected = [
    'Eve\r\nBcc: victim@example.net',
    'Eve\nBcc: victim@example.net',
    'Eve\rBcc: victim@example.net',
    'Eve\u2028Bcc: victim@example.net',
    'Eve\r\n\r\nA body of my own',
  ]

  it.each(injected)(
    'a line break in the name never starts a header of its own (%j)',
    async (name) => {
      const state = await send({ name })
      expect(state.status).toBe('success')
      // What reaches nodemailer's header fields is already free of line breaks: the stripping is
      // ours, not left to the library's encoding.
      const { mail } = deliveries[0]!
      const headerValues = [
        mail.subject,
        (mail.replyTo as { name: string }).name,
        (mail.from as { name: string }).name,
      ]
      for (const value of headerValues) expect(value).not.toMatch(/[\r\n\u2028\u2029]/)
      const head = headerSection(deliveries[0]!.raw)
      expect(head.has('bcc')).toBe(false)
      expect(head.get('to')).toEqual(['studio-inbox@example.com'])
      // One Subject, one Reply-To, each a single header.
      expect(head.get('subject')).toHaveLength(1)
      expect(head.get('reply-to')).toHaveLength(1)
      for (const [key] of head)
        expect([
          '',
          'content-type',
          'from',
          'to',
          'reply-to',
          'subject',
          'message-id',
          'content-transfer-encoding',
          'date',
          'mime-version',
        ]).toContain(key)
    },
  )

  it('refuses an e-mail address that carries a line break, a list or a display name', async () => {
    for (const email of [
      'visitor@example.org\r\nBcc: victim@example.net',
      'visitor@example.org, victim@example.net',
      'Visitor <visitor@example.org>',
      '"a b"@example.org',
    ]) {
      const state = await sendAsNewVisitor({ email })
      expectRefused(state)
      expect(state.errors?.email, email).toBeTruthy()
    }
  })
})

describe('refusals: never "sent", nothing handed to the mail server', () => {
  it('a filled honeypot', async () => {
    const state = await send({ website: 'https://spam.example' })
    expectRefused(state)
    expect(state.values).toBeUndefined()
  })

  it.each(Object.keys(RELAY_ENV).filter((name) => name !== 'CONTACT_SMTP_PORT'))(
    "no relay account: %s missing, and Payload's own mail is never the fallback",
    async (name) => {
      delete process.env[name]
      const fallback = vi.spyOn(payload, 'sendEmail')
      const state = await send()
      expectRefused(state)
      expect(fallback).not.toHaveBeenCalled()
      expect(vi.mocked(nodemailer.createTransport)).not.toHaveBeenCalled()
    },
  )

  it('a malformed port or address in the relay settings', async () => {
    for (const [name, value] of [
      ['CONTACT_SMTP_PORT', 'smtp'],
      ['CONTACT_SMTP_PORT', '70000'],
      ['CONTACT_FROM', 'Website <website@example.com>'],
      ['CONTACT_TO', 'studio-inbox@example.com, other@example.com'],
    ] as const) {
      Object.assign(process.env, RELAY_ENV, { [name]: value })
      expectRefused(await sendAsNewVisitor())
    }
  })

  it('missing or wrong fields, each with its own message', async () => {
    const cases: [FormFields, keyof NonNullable<InquiryState['errors']>][] = [
      [{ name: '' }, 'name'],
      [{ email: '' }, 'email'],
      [{ email: 'not an address' }, 'email'],
      [{ message: '' }, 'message'],
      [{ consent: undefined }, 'consent'],
    ]
    for (const [fields, key] of cases) {
      const state = await sendAsNewVisitor(fields)
      expectRefused(state)
      expect(state.errors?.[key], JSON.stringify(fields)).toBeTruthy()
    }
  })

  it('a form sent sooner than a person could fill it in', async () => {
    expectRefused(await send({ formStarted: issueFormToken(Date.now()) ?? '' }))
  })

  it('a missing, forged, stale or future fill-in time', async () => {
    const genuine = issueFormToken(Date.now() - 10_000)!
    const [issuedAt, id, signature] = genuine.split('.')
    const other = issueFormToken(Date.now() - 10_000)!.split('.')[1]
    for (const formStarted of [
      undefined,
      '',
      `${Number(issuedAt) - 60_000}.${id}.${signature}`,
      `${issuedAt}.${other}.${signature}`,
      `${issuedAt}.${id}.${'A'.repeat(43)}`,
      `${issuedAt}.${signature}`,
      issueFormToken(Date.now() - MAX_FORM_AGE_MS - 1000)!,
      issueFormToken(Date.now() + 60_000)!,
    ]) {
      expectRefused(await sendAsNewVisitor({ formStarted }))
    }
  })

  it('a missing, malformed or tampered proof of work', async () => {
    const good = JSON.parse(Buffer.from(await solvedProof(), 'base64').toString())
    const key: string = good.solution.derivedKey
    const tampered = {
      ...good,
      solution: {
        ...good.solution,
        derivedKey: `${key.slice(0, -1)}${key.endsWith('0') ? '1' : '0'}`,
      },
    }
    const resigned = {
      ...good,
      challenge: { ...good.challenge, parameters: { ...good.challenge.parameters, cost: 1 } },
    }
    const remote = {
      algorithm: 'SHA-256',
      signature: 'x',
      verificationData: 'verified=true',
      verified: true,
    }
    for (const altcha of [
      '',
      'not base64 json',
      Buffer.from(JSON.stringify(tampered)).toString('base64'),
      Buffer.from(JSON.stringify(resigned)).toString('base64'),
      Buffer.from(JSON.stringify(remote)).toString('base64'),
      'A'.repeat(10_000),
    ]) {
      expectRefused(await sendAsNewVisitor({ altcha }))
    }
  })

  it('a proof of work whose challenge expired', async () => {
    const old = await createProofChallenge({
      now: Date.now() - PROOF_LIFETIME_MS - 60_000,
      counter: [0, 20],
    })
    expectRefused(await send({ altcha: await solvedProof(old) }))
  })

  it('a proof of work used before: one solved puzzle, one message', async () => {
    const altcha = await solvedProof()
    expect((await send({ altcha })).status).toBe('success')
    newVisitor()
    deliveries = []
    expectRefused(await send({ altcha }))
  })

  it('a form that already sent its message: one rendered form, one message', async () => {
    const formStarted = issueFormToken(Date.now() - 10_000)!
    expect((await send({ formStarted })).status).toBe('success')
    newVisitor()
    deliveries = []
    const again = await send({ formStarted })
    expectRefused(again)
    expect(again.message).toMatch(/already sent a message/)
    // Another rendered form still sends.
    newVisitor()
    expect((await send()).status).toBe('success')
  })

  it('a send the mail server refused does not use up the form', async () => {
    const formStarted = issueFormToken(Date.now() - 10_000)!
    serverAnswer = 'throw'
    expect((await send({ formStarted })).status).toBe('error')
    serverAnswer = 'accept'
    newVisitor()
    expect((await send({ formStarted })).status).toBe('success')
  })

  it('a validation error does not use up the proof of work', async () => {
    const altcha = await solvedProof()
    expectRefused(await send({ altcha, message: '' }))
    expect((await send({ altcha })).status).toBe('success')
  })

  it('a mail server that refuses the message', async () => {
    serverAnswer = 'throw'
    const state = await send()
    expect(state.status).toBe('error')
    expect(state.message).toContain(STUDIO_EMAIL)
    // It was handed over and refused; the visitor keeps what they typed.
    expect(state.values?.message).toBe('A question about a project.')
  })

  it("a mail server that takes the message but not for the studio's address", async () => {
    serverAnswer = 'reject-recipient'
    const state = await send()
    expect(state.status).toBe('error')
    expect(state.message).toContain(STUDIO_EMAIL)
  })
})

describe('the per-address rate limit', () => {
  it('stops one address after a burst, and nothing more reaches the mail server', async () => {
    const states: InquiryState[] = []
    for (let i = 0; i < 8; i++) states.push(await send())
    expect(states.slice(0, 5).every((state) => state.status === 'success')).toBe(true)
    expect(states.slice(5).every((state) => state.status === 'error')).toBe(true)
    expect(deliveries).toHaveLength(5)
  })

  it('keys on the address the proxy appended, so a forged earlier entry does not escape it', async () => {
    const proxySaw = address
    for (let i = 0; i < 8; i++) {
      vi.mocked(headers).mockImplementation(
        async () => new Headers({ 'x-forwarded-for': `10.0.0.${i}, ${proxySaw}` }) as never,
      )
      await send()
    }
    expect(deliveries).toHaveLength(5)
    // Another visitor is not affected.
    newVisitor()
    vi.mocked(headers).mockImplementation(
      async () => new Headers({ 'x-forwarded-for': address }) as never,
    )
    expect((await send()).status).toBe('success')
  })
})

describe('the per-address daily cap', () => {
  // The clock is moved two minutes per request, so the burst bucket (one a minute) never refuses
  // and only the daily cap can. Only Date is faked; Payload's timers keep running.
  const hours = (start: string, run: (tick: () => void) => Promise<void>) => async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(start))
    try {
      await run(() => vi.setSystemTime(Date.now() + 2 * 60_000))
    } finally {
      vi.useRealTimers()
    }
  }

  it(
    'counts only messages that passed the checks, so bare requests cannot close the form',
    hours('2026-10-20T06:00:00.000Z', async (tick) => {
      for (let i = 0; i < 40; i++) {
        tick()
        expectRefused(await sendInquiry({ status: 'idle' }, new FormData()))
      }
      tick()
      expect((await send()).status).toBe('success')
    }),
    120_000,
  )

  it(
    'stops one address after thirty messages in a day',
    hours('2026-10-20T06:00:00.000Z', async (tick) => {
      const states: InquiryState[] = []
      for (let i = 0; i < 31; i++) {
        tick()
        states.push(await send())
      }
      expect(states.slice(0, 30).every((state) => state.status === 'success')).toBe(true)
      expect(states[30]?.status).toBe('error')
      expect(deliveries).toHaveLength(30)
    }),
    120_000,
  )
})

describe('IPv6 visitors', () => {
  const from = (ip: string) =>
    vi
      .mocked(headers)
      .mockImplementation(async () => new Headers({ 'x-forwarded-for': ip }) as never)

  it('share a limit across their /64, the block one host is normally given', async () => {
    const network = `2001:db8:${addressCounter.toString(16)}:1`
    for (let i = 1; i <= 5; i++) {
      from(`${network}::${i.toString(16)}`)
      expect((await send()).status).toBe('success')
    }
    from(`${network}:ffff:ffff:ffff:fff0`)
    expect((await send()).status).toBe('error')
    // The next /64 is another visitor.
    from(`2001:db8:${addressCounter.toString(16)}:2::1`)
    expect((await send()).status).toBe('success')
  })
})

describe('a real network connection', () => {
  /** A mail server that speaks SMTP in clear text and offers no STARTTLS. It records everything
   * a client sends it. */
  const plainServer = async () => {
    const received: string[] = []
    const sockets = new Set<Socket>()
    const server: Server = createServer((socket) => {
      sockets.add(socket)
      socket.write('220 plain.example.com ESMTP\r\n')
      socket.on('data', (chunk) => {
        const text = chunk.toString('utf8')
        received.push(text)
        for (const line of text.split('\r\n').filter(Boolean)) {
          const verb = line.slice(0, 4).toUpperCase()
          if (verb === 'EHLO') socket.write('250-plain.example.com\r\n250 AUTH PLAIN LOGIN\r\n')
          else if (verb === 'HELO') socket.write('250 plain.example.com\r\n')
          else if (verb === 'QUIT') socket.end('221 bye\r\n')
          else if (verb === 'DATA') socket.write('354 go ahead\r\n')
          else socket.write('250 ok\r\n')
        }
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = (server.address() as { port: number }).port
    const close = () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy()
        server.close(() => resolve())
      })
    return { port, received, close }
  }

  it('a server without STARTTLS gets neither the login nor the message', async () => {
    vi.mocked(nodemailer.createTransport).mockRestore()
    const server = await plainServer()
    try {
      Object.assign(process.env, {
        CONTACT_SMTP_HOST: '127.0.0.1',
        CONTACT_SMTP_PORT: String(server.port),
      })
      const state = await send({ message: 'plain-text-marker-0x51' })
      expect(state.status).toBe('error')
      expect(state.message).toContain(STUDIO_EMAIL)
      const conversation = server.received.join('')
      expect(conversation).toMatch(/^EHLO/m)
      expect(conversation).not.toMatch(/^(AUTH|MAIL FROM|RCPT TO|DATA)/im)
      expect(conversation).not.toContain('plain-text-marker-0x51')
      expect(conversation).not.toContain(RELAY_ENV.CONTACT_SMTP_PASS)
    } finally {
      await server.close()
    }
  })
})

describe('nothing is kept and nothing is logged', () => {
  const marker = () => `marker-${Date.now()}-${Math.random().toString(36).slice(2)}`

  /** Rows anywhere in the database whose text contains `needle`. */
  const databaseHits = async (needle: string) => {
    const pool = (
      payload.db as unknown as {
        pool: {
          query: (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
        }
      }
    ).pool
    const { rows: tables } = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
    )
    let hits = 0
    for (const { table_name } of tables) {
      const { rows } = await pool.query(
        `SELECT count(*)::int AS n FROM "${String(table_name)}" AS r WHERE r::text LIKE $1`,
        [`%${needle}%`],
      )
      hits += Number(rows[0]?.n ?? 0)
    }
    return hits
  }

  /** Files written since `since` (under the project and the system's temp directory) that
   * contain `needle`. */
  const fileHits = async (needle: string, since: number) => {
    const skip = new Set(['node_modules', '.git', '.next', 'playwright-report', 'test-results'])
    const hits: string[] = []
    const walk = async (dir: string, depth: number): Promise<void> => {
      if (depth > 6) return
      let entries
      try {
        entries = await readdir(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (!skip.has(entry.name)) await walk(full, depth + 1)
        } else if (entry.isFile()) {
          try {
            const info = await stat(full)
            if (info.mtimeMs < since || info.size > 5_000_000) continue
            if ((await readFile(full, 'utf8')).includes(needle)) hits.push(full)
          } catch {
            // unreadable: not ours
          }
        }
      }
    }
    await walk(process.cwd(), 0)
    await walk(os.tmpdir(), 3)
    return hits
  }

  /** How many documents every collection holds. */
  const countEverything = async () =>
    Object.fromEntries(
      await Promise.all(
        payload.config.collections.map(async ({ slug }) => [
          slug,
          (await payload.count({ collection: slug as 'users' })).totalDocs,
        ]),
      ),
    )

  it.each(['accept', 'throw'] as const)(
    'the message leaves no trace in the database or on disk (server answer: %s)',
    async (answer) => {
      serverAnswer = answer
      const needle = marker()
      const started = Date.now() - 1000
      const before = await countEverything()
      await send({ name: `Visitor ${needle}`, message: `Text ${needle}` })
      expect(deliveries).toHaveLength(1)
      expect(await countEverything()).toEqual(before)
      expect(await databaseHits(needle)).toBe(0)
      expect(await fileHits(needle, started)).toEqual([])
    },
  )

  it('nothing the visitor wrote reaches a log line, also when the server refuses', async () => {
    const needle = marker()
    const output: string[] = []
    const capture = (...args: unknown[]) => {
      output.push(
        args.map((arg) => (typeof arg === 'string' ? arg : inspect(arg, { depth: 6 }))).join(' '),
      )
    }
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation(capture)
    }
    for (const stream of [process.stdout, process.stderr]) {
      const write = stream.write.bind(stream)
      vi.spyOn(stream, 'write').mockImplementation(((chunk: unknown, ...rest: unknown[]) => {
        output.push(String(chunk))
        return (write as (...args: unknown[]) => boolean)(chunk, ...rest)
      }) as typeof stream.write)
    }
    const logged = vi
      .spyOn(payload.logger, 'warn')
      .mockImplementation(((...args: unknown[]) => capture(...args)) as never)
    for (const method of ['info', 'error', 'debug', 'trace', 'fatal'] as const) {
      vi.spyOn(payload.logger, method).mockImplementation(((...args: unknown[]) =>
        capture(...args)) as never)
    }

    const fields = {
      name: `Name ${needle}`,
      email: `${needle}@example.org`,
      message: `Text ${needle}`,
    }
    await send(fields)
    serverAnswer = 'throw'
    await send(fields)

    // The refusal was logged (so this spied on the logger the action uses), with a code only.
    expect(logged).toHaveBeenCalledTimes(1)
    expect(logged.mock.calls[0]![0]).toEqual({ code: 'EENVELOPE', responseCode: 550 })
    const everything = output.join('\n')
    for (const value of [needle, 'studio-inbox@example.com']) {
      expect(everything).not.toContain(value)
    }
  })
})

describe('languages', () => {
  it('answers in the language of the page the form was on, and falls back to English', async () => {
    delete process.env.CONTACT_TO
    const [en, hr, unknown] = await Promise.all(
      ['en', 'hr', 'xx'].map((locale) => send({ locale })),
    )
    expect(en.message).toBeTruthy()
    expect(hr.message).not.toBe(en.message)
    expect(unknown.message).toBe(en.message)
    for (const state of [en, hr]) expect(state.message).toContain(STUDIO_EMAIL)
  })

  it('writes to the studio in English, whichever page the visitor wrote from', async () => {
    expect((await send({ locale: 'hr' })).status).toBe('success')
    expect(deliveries[0]!.mail.subject).toBe('fromnowhere.dev: a message from Test Visitor')
    expect(String(deliveries[0]!.mail.text)).toContain('Page language: Hrvatski')
  })

  it('every language refuses with the studio address when the relay is off', async () => {
    delete process.env.CONTACT_SMTP_HOST
    for (const locale of locales) {
      const state = await send({ locale })
      expect(state.status, locale).toBe('error')
      expect(state.message, locale).toContain(STUDIO_EMAIL)
    }
  })
})

describe('the challenge route', () => {
  const request = () =>
    challengeRoute(
      new Request('http://localhost:3000/api/contact/challenge', {
        headers: { 'x-forwarded-for': address },
      }),
    )

  it('hands out a challenge whose solution the action accepts (production difficulty)', async () => {
    const response = await request()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const challenge = (await response.json()) as Challenge
    expect((await send({ altcha: await solvedProof(challenge) })).status).toBe('success')
  }, 60_000)

  it('answers 503 while the relay is not set up', async () => {
    delete process.env.CONTACT_SMTP_HOST
    expect((await request()).status).toBe(503)
  })

  it('limits one address', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 25; i++) statuses.push((await request()).status)
    expect(statuses.slice(0, 20).every((status) => status === 200)).toBe(true)
    expect(statuses.slice(20)).toContain(429)
  })
})
