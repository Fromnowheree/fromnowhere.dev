import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

/**
 * scripts/restore.sh, run for real against a stand-in for `docker compose` that logs every call
 * with the number of bytes it was handed on stdin, and keeps what `pg_restore` (or the uploads'
 * `tar`) received. What it holds: the backup reaches the restore whole (no other call can swallow
 * a part of it), a restore that fails changes nothing and stops nothing, and the live database
 * is replaced, and the site stopped for it, only once the copy is complete. That it works on a
 * real stack is a drill (README, "Backups"), not this test.
 */
const script = path.resolve('scripts/restore.sh')

// One line per call: the container scripts' own line breaks become spaces.
const fakeCompose = `#!/usr/bin/env bash
set -u
call="$*"
call="\${call//$'\\n'/ }"
if [[ "$call" == *pg_restore* || "$call" == *"tar -C /app"* ]]; then
  cat > "$FAKE_RECEIVED"
  echo "RESTORE $call" >> "$FAKE_LOG"
  [ "\${FAKE_RESTORE_FAIL:-}" = 1 ] && exit 1
  exit 0
fi
bytes="$(cat | wc -c | tr -d ' ')"
echo "$call [stdin $bytes]" >> "$FAKE_LOG"
`

const tools = mkdtempSync(path.join(tmpdir(), 'restore-tools-'))
let work: string

beforeAll(() => {
  writeFileSync(path.join(tools, 'compose'), fakeCompose)
  chmodSync(path.join(tools, 'compose'), 0o755)
})

afterEach(() => {
  if (work) rmSync(work, { recursive: true, force: true })
})

// A backup's bytes, larger than a pipe's buffer so a call that read stdin would take a part.
const backup = Buffer.from('PGDMP'.padEnd(200_000, 'x'))

const run = (args: string[], input: Buffer | null, extraEnv: Record<string, string> = {}) => {
  work = mkdtempSync(path.join(tmpdir(), 'restore-project-'))
  mkdirSync(path.join(work, 'scripts'))
  copyFileSync(script, path.join(work, 'scripts/restore.sh'))
  const log = path.join(tools, 'log')
  const received = path.join(tools, 'received')
  writeFileSync(log, '')
  rmSync(received, { force: true })
  const result = spawnSync('bash', [path.join(work, 'scripts/restore.sh'), ...args], {
    input: input ?? undefined,
    stdio: [input ? 'pipe' : 'inherit', 'pipe', 'pipe'],
    env: {
      PATH: process.env.PATH ?? '',
      NODE_ENV: 'test',
      COMPOSE: path.join(tools, 'compose'),
      FAKE_LOG: log,
      FAKE_RECEIVED: received,
      ...extraEnv,
    },
  })
  const calls = readFileSync(log, 'utf8').split('\n').filter(Boolean)
  return {
    status: result.status,
    stderr: result.stderr.toString(),
    calls,
    received: existsSync(received) ? readFileSync(received) : null,
  }
}

const index = (calls: string[], pattern: RegExp) => calls.findIndex((call) => pattern.test(call))

describe('scripts/restore.sh', () => {
  it('hands the whole backup to pg_restore, and nothing of it to any other call', () => {
    const { status, calls, received } = run(['db'], backup)
    expect(status).toBe(0)
    expect(received?.equals(backup)).toBe(true)
    for (const call of calls.filter((call) => !call.startsWith('RESTORE'))) {
      expect(call).toMatch(/\[stdin 0\]$/)
    }
  })

  it('restores into a scratch database and stops the site only once the copy is complete', () => {
    const { calls } = run(['db'], backup)
    const restored = index(calls, /^RESTORE .*pg_restore .*_restoring/)
    const stopped = index(calls, /^stop caddy app /)
    const swapped = index(calls, /RENAME TO/)
    expect(restored).toBeGreaterThan(-1)
    expect(stopped).toBeGreaterThan(restored)
    expect(swapped).toBeGreaterThan(stopped)
    expect(calls.at(-1)).toMatch(/^up -d /)
  })

  it('changes nothing and stops nothing when the backup cannot be restored', () => {
    const { status, stderr, calls } = run(['db'], backup, { FAKE_RESTORE_FAIL: '1' })
    expect(status).not.toBe(0)
    expect(stderr).toMatch(/nothing was changed/)
    expect(calls.some((call) => /^stop |RENAME TO|^up /.test(call))).toBe(false)
    // The half-made scratch database is removed again.
    expect(calls.at(-1)).toMatch(/dropdb .*_restoring/)
  })

  it('restores the uploads into the running app, whole', () => {
    const media = Buffer.from('tar bytes'.padEnd(100_000, 'm'))
    const { status, calls, received } = run(['media'], media)
    expect(status).toBe(0)
    expect(received?.equals(media)).toBe(true)
    expect(calls.some((call) => /^stop /.test(call))).toBe(false)
  })

  it('refuses without saying what to restore, before running anything', () => {
    for (const args of [[], ['everything']]) {
      const { status, stderr, calls } = run(args, backup)
      expect(status).not.toBe(0)
      expect(stderr).toMatch(/db, media or stats/)
      expect(calls).toEqual([])
    }
  })
})
