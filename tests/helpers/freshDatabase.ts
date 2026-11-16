import type { Payload } from 'payload'
import pg from 'pg'

/**
 * Points this test file at a database of its own, created empty next to the one DATABASE_URL
 * names (the throwaway test server), for tests that need a state the shared database cannot
 * promise: no users at all, or no content yet. Call it BEFORE importing the Payload config,
 * which reads DATABASE_URL when it loads; Vitest runs each test file in a process of its own,
 * so the change reaches no other file.
 *
 * `drop(payload)` shuts that Payload down and removes the database again.
 */
export async function useFreshDatabase(
  label: string,
): Promise<{ drop: (payload?: Payload) => Promise<void> }> {
  const base = process.env.DATABASE_URL
  if (!base) throw new Error('DATABASE_URL is not set')
  const name = `pw_test_${label}_${process.pid}_${Date.now()}`
  const run = async (sql: string) => {
    const client = new pg.Client({ connectionString: base })
    await client.connect()
    try {
      await client.query(sql)
    } finally {
      await client.end()
    }
  }
  await run(`CREATE DATABASE "${name}"`)
  const url = new URL(base)
  url.pathname = `/${name}`
  process.env.DATABASE_URL = url.toString()

  const drop = async (payload?: Payload) => {
    if (payload) {
      await payload.destroy()
      // Payload's destroy() leaves its Postgres pool open (and pool.end() would wait for a
      // client it never releases), so the drop below cuts those connections. That is expected
      // here; without a listener the pool would report it as an unhandled error.
      ;(payload.db as unknown as { pool?: Pick<pg.Pool, 'on'> }).pool?.on('error', () => {})
    }
    await run(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
  }
  return { drop }
}
