import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

/**
 * scripts/backup.sh, run for real against a stand-in for `docker compose` whose "database" and
 * "uploads" are a known plaintext marker. The encryption is the real `age` (CI installs it), so
 * these tests hold what the script promises: what reaches the disk is only ciphertext that the
 * private key opens, nothing is read or written without a recipient, a failed dump leaves no
 * file that looks like a backup, and retention removes only old backups.
 */

const MARKER = 'PLAINTEXT-MARKER'
const script = path.resolve('scripts/backup.sh')

// A stand-in for `docker compose exec -T <service> ...`. Its behaviour is set per run through
// FAKE_* variables; every call is logged (outside the project) so a test can see what was read.
const fakeCompose = `#!/usr/bin/env bash
set -eu
echo "$*" >> "$FAKE_LOG"
service="$3"
if [ "$service" = app ]; then
  printf '%s-MEDIA uploaded image bytes\\n' "${MARKER}"
  exit 0
fi
case "$6" in
  *pg_dump*)
    printf '%s-DB rows of database "%s"\\n' "${MARKER}" "\${8:-site}"
    if [ "\${FAKE_DUMP_FAIL:-}" = 1 ]; then exit 1; fi ;;
  *psql*)
    sql="$(cat)"
    case "$sql" in
      *pg_database*) echo "\${FAKE_UMAMI:-}" ;;
      *to_regclass*) echo "\${FAKE_UMAMI_TABLES:-f}" ;;
      *BEGIN*) if [ "\${FAKE_CLEANUP_FAIL:-}" = 1 ]; then exit 3; fi ;;
    esac ;;
esac
`

let identity: string
let recipient: string
let work: string

const tools = mkdtempSync(path.join(tmpdir(), 'backup-tools-'))

beforeAll(() => {
  identity = path.join(tools, 'key.txt')
  execFileSync('age-keygen', ['-o', identity], { stdio: 'ignore' })
  recipient = execFileSync('age-keygen', ['-y', identity]).toString().trim()
  writeFileSync(path.join(tools, 'compose'), fakeCompose)
  chmodSync(path.join(tools, 'compose'), 0o755)
})

afterEach(() => {
  if (work) rmSync(work, { recursive: true, force: true })
})

/** A project directory holding the script and an .env with these lines; returns the run. */
const run = (envLines: string[], extraEnv: Record<string, string> = {}) => {
  work = mkdtempSync(path.join(tmpdir(), 'backup-project-'))
  mkdirSync(path.join(work, 'scripts'))
  copyFileSync(script, path.join(work, 'scripts/backup.sh'))
  writeFileSync(path.join(work, '.env'), envLines.join('\n') + '\n')
  writeFileSync(path.join(tools, 'log'), '')
  const result = spawnSync('bash', [path.join(work, 'scripts/backup.sh')], {
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      NODE_ENV: 'test',
      COMPOSE: path.join(tools, 'compose'),
      FAKE_LOG: path.join(tools, 'log'),
      ...extraEnv,
    },
    encoding: 'utf8',
  })
  return { ...result, calls: readFileSync(path.join(tools, 'log'), 'utf8') }
}

/** Every file under `dir`, recursively. */
const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? filesUnder(full) : [full]
  })

const backups = () =>
  existsSync(path.join(work, 'backups')) ? readdirSync(path.join(work, 'backups')).sort() : []

const decrypt = (file: string) =>
  execFileSync('age', ['-d', '-i', identity, path.join(work, 'backups', file)]).toString()

describe('scripts/backup.sh', () => {
  it('writes only age ciphertext, which the private key opens', () => {
    const result = run([`BACKUP_RECIPIENT=${recipient}`])
    expect(result.status, result.stderr).toBe(0)

    const files = backups()
    expect(files.some((f) => /^db-\d{8}-\d{6}\.dump\.age$/.test(f))).toBe(true)
    expect(files.some((f) => /^media-\d{8}-\d{6}\.tar\.gz\.age$/.test(f))).toBe(true)
    expect(files.every((f) => f.endsWith('.age'))).toBe(true)

    // No file anywhere in the project holds the plaintext, partials included.
    for (const file of filesUnder(work)) {
      expect(readFileSync(file, 'latin1'), file).not.toContain(MARKER)
    }
    // ...and the ciphertext is the real content.
    expect(decrypt(files.find((f) => f.startsWith('db-'))!)).toContain(`${MARKER}-DB`)
    expect(decrypt(files.find((f) => f.startsWith('media-'))!)).toContain(`${MARKER}-MEDIA`)
  })

  it('backs up the statistics database too once it exists, encrypted', () => {
    const result = run([`BACKUP_RECIPIENT=${recipient}`], { FAKE_UMAMI: '1' })
    expect(result.status, result.stderr).toBe(0)
    const umami = backups().find((f) => f.startsWith('umami-'))
    expect(umami).toBeDefined()
    expect(decrypt(umami!)).toContain('database "umami"')
  })

  it('still backs up and keeps to its retention when the statistics clean-up fails, and says so', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'backup-dir-'))
    writeFileSync(path.join(dir, 'db-20200101-033000.dump.age'), 'x')
    const when = new Date(Date.now() - 40 * 86_400_000)
    utimesSync(path.join(dir, 'db-20200101-033000.dump.age'), when, when)
    const result = run([`BACKUP_RECIPIENT=${recipient}`, `BACKUP_DIR=${dir}`], {
      FAKE_UMAMI: '1',
      FAKE_UMAMI_TABLES: 't',
      FAKE_CLEANUP_FAIL: '1',
    })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/could NOT be deleted from the statistics/)
    const left = readdirSync(dir)
    expect(left.some((f) => f.startsWith('umami-'))).toBe(true)
    expect(left.some((f) => /^db-\d{8}-\d{6}/.test(f) && f !== 'db-20200101-033000.dump.age')).toBe(
      true,
    )
    expect(left).not.toContain('db-20200101-033000.dump.age')
    rmSync(dir, { recursive: true, force: true })
  })

  it('encrypts to every recipient listed', () => {
    const second = path.join(tools, 'second.txt')
    rmSync(second, { force: true })
    execFileSync('age-keygen', ['-o', second], { stdio: 'ignore' })
    const other = execFileSync('age-keygen', ['-y', second]).toString().trim()
    expect(run([`BACKUP_RECIPIENT="${recipient}, ${other}"`]).status).toBe(0)
    const db = backups().find((f) => f.startsWith('db-'))!
    const opened = execFileSync('age', ['-d', '-i', second, path.join(work, 'backups', db)])
    expect(opened.toString()).toContain(`${MARKER}-DB`)
  })

  it('refuses without a recipient, before reading anything', () => {
    const result = run(['BACKUP_RECIPIENT='])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('BACKUP_RECIPIENT')
    expect(result.calls).toBe('')
    expect(backups()).toEqual([])
  })

  it('refuses a recipient that is not an age public key', () => {
    const result = run(['BACKUP_RECIPIENT=not-a-key'])
    expect(result.status).not.toBe(0)
    expect(result.calls).toBe('')
    expect(backups()).toEqual([])
  })

  it('never sources .env', () => {
    const canary = path.join(tools, 'sourced')
    rmSync(canary, { force: true })
    const result = run([`BACKUP_RECIPIENT=${recipient}`, `X=$(touch ${canary})`, `touch ${canary}`])
    expect(result.status, result.stderr).toBe(0)
    expect(existsSync(canary)).toBe(false)
  })

  it('leaves no backup-looking file when a dump fails', () => {
    const result = run([`BACKUP_RECIPIENT=${recipient}`], { FAKE_DUMP_FAIL: '1' })
    expect(result.status).not.toBe(0)
    expect(backups().filter((f) => f.startsWith('db-'))).toEqual([])
    expect(backups().filter((f) => f.endsWith('.partial'))).toEqual([])
  })

  it('deletes only its own backups older than BACKUP_KEEP_DAYS', () => {
    work = mkdtempSync(path.join(tmpdir(), 'backup-project-'))
    const dir = mkdtempSync(path.join(tmpdir(), 'backup-dir-'))
    const old = (name: string, days: number) => {
      writeFileSync(path.join(dir, name), 'x')
      const when = new Date(Date.now() - days * 86_400_000)
      utimesSync(path.join(dir, name), when, when)
    }
    old('db-20200101-033000.dump.age', 10)
    old('media-20200101-033000.tar.gz.age', 10)
    old('db-20200108-033000.dump.age', 3)
    old('backup.log', 400)
    old('notes.txt', 400)
    rmSync(work, { recursive: true, force: true })

    const result = run([`BACKUP_RECIPIENT=${recipient}`, 'BACKUP_KEEP_DAYS=7', `BACKUP_DIR=${dir}`])
    expect(result.status, result.stderr).toBe(0)
    const left = readdirSync(dir)
    expect(left).not.toContain('db-20200101-033000.dump.age')
    expect(left).not.toContain('media-20200101-033000.tar.gz.age')
    expect(left).toContain('db-20200108-033000.dump.age')
    expect(left).toContain('backup.log')
    expect(left).toContain('notes.txt')
    // Tonight's set is there, and private to the owner.
    const tonight = left.filter((f) => f.startsWith('db-') && f !== 'db-20200108-033000.dump.age')
    expect(tonight).toHaveLength(1)
    expect(statSync(path.join(dir, tonight[0]!)).mode & 0o077).toBe(0)
    rmSync(dir, { recursive: true, force: true })
  })

  it('refuses a retention that is not a whole number of days', () => {
    const result = run([`BACKUP_RECIPIENT=${recipient}`, 'BACKUP_KEEP_DAYS=0'])
    expect(result.status).not.toBe(0)
    expect(result.calls).toBe('')
  })
})
