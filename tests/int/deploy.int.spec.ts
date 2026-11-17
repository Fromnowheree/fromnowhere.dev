import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

/**
 * The deployment files: compose.yml, compose.stats.yml, the Caddy template (and its folder of
 * other sites) and the Dockerfile.
 * They are configuration, not code, so what is checked here is what they promise the server.
 */

type Service = {
  image?: string
  build?: unknown
  profiles?: string[]
  ports?: string[]
  environment?: Record<string, string>
  env_file?: unknown
  volumes?: string[]
  user?: string
}
type Compose = {
  services: Record<string, Service>
  networks?: Record<string, { enable_ipv6?: boolean } | null>
}

const read = (file: string) => readFileSync(path.resolve(file), 'utf8')
const compose = parse(read('compose.yml')) as Compose
const stats = parse(read('compose.stats.yml')) as Compose
const caddyfile = read('caddy/Caddyfile')

/** Every file under `dir` with one of the extensions. */
const sourceFiles = (dir: string, exts: string[]): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return sourceFiles(full, exts)
    return exts.some((ext) => name.endsWith(ext)) ? [full] : []
  })

/** The text of everything the app container runs: the app's source and the provisioning script. */
const appCode = [
  ...sourceFiles('src', ['.ts', '.tsx']).filter((f) => !f.endsWith('payload-types.ts')),
  'next.config.ts',
  'scripts/create-admin.mjs',
]
  .map(read)
  .join('\n')

/** The variables .env.example documents. */
const documented = read('.env.example')
  .split('\n')
  .map((line) => /^#?\s*([A-Z][A-Z0-9_]+)=/.exec(line)?.[1])
  .filter((name): name is string => Boolean(name))

const readByApp = (name: string) => new RegExp(`\\b${name}\\b`).test(appCode)

// Read by the app, but only by `next dev`; it has no meaning in a production container.
const DEV_ONLY = ['DEV_ALLOWED_ORIGINS']

describe('compose.yml', () => {
  const app = compose.services.app!

  it('hands the app every documented variable its code reads', () => {
    const missing = documented
      .filter((name) => readByApp(name) && !DEV_ONLY.includes(name))
      .filter((name) => !(name in (app.environment ?? {})))
    expect(missing).toEqual([])
  })

  it('hands the app nothing else: no whole .env, no database or statistics secrets, no backup settings', () => {
    expect(app.env_file).toBeUndefined()
    const unread = Object.keys(app.environment ?? {}).filter((name) => !readByApp(name))
    expect(unread).toEqual([])
    for (const secret of ['POSTGRES_PASSWORD', 'UMAMI_APP_SECRET', 'UMAMI_DB_PASSWORD']) {
      expect(Object.keys(app.environment ?? {})).not.toContain(secret)
    }
  })

  // The postgres image makes POSTGRES_USER a superuser: the app logs in as its own role, `app`
  // (db/init/app-role.psql, tests/int/appRole.int.spec.ts), whose password the db hands the
  // script that creates it. Both refuse to start without it.
  it('logs the app in as its own database role, never as the superuser', () => {
    const url = app.environment?.DATABASE_URL ?? ''
    expect(url).not.toMatch(/POSTGRES_(USER|PASSWORD)/)
    expect(url).toMatch(/^postgres:\/\/app:\$\{APP_DB_PASSWORD:\?[^}]+\}@db:5432\//)
    expect(compose.services.db?.environment?.APP_DB_PASSWORD).toMatch(/^\$\{APP_DB_PASSWORD:\?/)
    expect(read('.env.example')).toMatch(/^APP_DB_PASSWORD=$/m)
  })

  it('never seeds the starting content unless told: off in compose and in .env.example', () => {
    expect(read('.env.example')).toMatch(/^PAYLOAD_SEED=false$/m)
    expect(app.environment?.PAYLOAD_SEED).toBe('${PAYLOAD_SEED:-false}')
  })

  it('builds nothing on the VPS: every service runs a named image', () => {
    for (const [name, service] of Object.entries(compose.services)) {
      expect(service.build, name).toBeUndefined()
      expect(service.image, name).toBeTruthy()
    }
  })

  it('publishes ports only for Caddy', () => {
    const published = Object.entries(compose.services)
      .filter(([, service]) => service.ports?.length)
      .map(([name]) => name)
    expect(published).toEqual(['caddy'])
  })

  it('gives the stack’s network IPv6, so Docker hands Caddy an IPv6 visitor’s own address', () => {
    expect(compose.networks?.default?.enable_ipv6).toBe(true)
  })
})

describe('visitor statistics (compose.stats.yml)', () => {
  const umami = stats.services.umami!

  it('are no part of the plain stack', () => {
    expect(compose.services.umami).toBeUndefined()
    expect(JSON.stringify(compose.services)).not.toMatch(/UMAMI_(APP_SECRET|DB_PASSWORD)/)
    for (const [name, service] of Object.entries(compose.services)) {
      expect(service.profiles, name).toBeUndefined()
    }
  })

  // Compose checks `${VAR:?}` across every file it reads, so these refuse to start Umami with an
  // empty session secret or database password, and never touch a server without statistics.
  it('refuse to start without Umami’s generated secrets', () => {
    const required = (name: string) => new RegExp(`\\$\\{${name}:\\?[^}]+\\}`)
    expect(umami.environment?.APP_SECRET).toMatch(required('UMAMI_APP_SECRET'))
    expect(umami.environment?.DATABASE_URL).toMatch(required('UMAMI_DB_PASSWORD'))
    expect(stats.services.db?.environment?.UMAMI_DB_PASSWORD).toMatch(required('UMAMI_DB_PASSWORD'))
    for (const value of Object.values(umami.environment ?? {})) expect(value).not.toMatch(/:-\}/)
  })

  it('publish no port and add nothing but Umami and its database password', () => {
    expect(umami.ports).toBeUndefined()
    expect(umami.image).toMatch(/^ghcr\.io\/umami-software\/umami:\d+\.\d+\.\d+$/)
    expect(Object.keys(stats.services).sort()).toEqual(['db', 'umami'])
    expect(Object.keys(stats.services.db ?? {})).toEqual(['environment'])
  })
})

describe('other sites on this server (caddy/sites)', () => {
  const siteAddresses = (file: string) =>
    file
      .split('\n')
      .filter((line) => /^\S.*\{\s*$/.test(line))
      .map((line) => line.replace(/\s*\{\s*$/, ''))

  it('are imported from the folder compose mounts, read-only', () => {
    const importDir = /^import (\/etc\/caddy\/sites)\/\*\.caddy$/m.exec(caddyfile)?.[1]
    expect(importDir).toBe('/etc/caddy/sites')
    const mount = compose.services.caddy?.volumes?.find((v) => v.startsWith('./caddy/sites:'))
    expect(mount?.split(':')[1]).toBe(importDir)
    expect(mount?.split(':')[2]).toMatch(/^ro\b/)
  })

  it('are none in a fresh copy, so a new server asks for no certificate but its own', () => {
    expect(readdirSync('caddy/sites').filter((name) => name.endsWith('.caddy'))).toEqual([])
    for (const address of siteAddresses(caddyfile))
      expect(address, address).toMatch(/\{\$(SITE_DOMAIN|STATS_DOMAIN)\}/)
  })

  type Overlay = {
    services: Record<
      string,
      { networks?: string[] | Record<string, { aliases?: string[] } | null> }
    >
    networks: Record<string, { name?: string; external?: boolean } | null>
  }
  const shared = parse(read('compose.shared.yml')) as Overlay
  const ygo = parse(read('deploy/fnwygo/compose.shared.yml')) as Overlay

  it('meet only Caddy on the shared network: no app or database of this stack joins it', () => {
    expect(Object.keys(shared.services)).toEqual(['caddy'])
    expect(shared.services.caddy.networks).toEqual(['default', 'sites'])
    expect(shared.networks.sites).toEqual({ name: 'fromnowhere-sites', external: true })
  })

  it('join it with their web container alone, under the alias their block proxies to', () => {
    expect(Object.keys(ygo.services)).toEqual(['web'])
    expect(ygo.networks.sites).toEqual({ name: 'fromnowhere-sites', external: true })
    const aliases = (ygo.services.web.networks as Record<string, { aliases?: string[] } | null>)
      .sites?.aliases
    const example = read('caddy/sites/yugioh.caddy.example')
    expect(siteAddresses(example)).toEqual(['yugioh.fromnowhere.dev'])
    const upstream = /reverse_proxy ([\w-]+):3000/.exec(example)?.[1]
    expect(aliases).toEqual([upstream])
  })
})

describe('the site block', () => {
  it('redirects www to the bare domain', () => {
    expect(caddyfile).toMatch(
      /^www\.\{\$SITE_DOMAIN\} \{\n\s*redir https:\/\/\{\$SITE_DOMAIN\}\{uri\} permanent/m,
    )
  })

  it('does not expose the first-admin endpoint, ahead of the catch-all proxy', () => {
    const refusal = caddyfile.search(
      /@firstRegister path \/api\/users\/first-register\n\s*handle @firstRegister \{\n\s*respond 404/,
    )
    expect(refusal).toBeGreaterThan(-1)
    // `handle` blocks run in the order written; a bare `respond` would run after every one.
    expect(refusal).toBeLessThan(caddyfile.indexOf('\thandle {'))
  })
})

describe('the editor', () => {
  it('answers only to ADMIN_ALLOW, the API with it, ahead of the catch-all proxy', () => {
    const guard = caddyfile.search(
      /@editor \{\n\s*path \/admin \/admin\/\* \/api \/api\/\*\n\s*not path \/api\/media\/file\/\* \/api\/contact\/\*\n\s*not remote_ip \{\$ADMIN_ALLOW\}\n\s*\}\n\s*handle @editor \{\n\s*respond 404/,
    )
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(caddyfile.indexOf('\thandle {'))
  })

  it('cannot start without ADMIN_ALLOW: no default opens it to everyone', () => {
    expect(compose.services.caddy?.environment?.ADMIN_ALLOW).toMatch(/^\$\{ADMIN_ALLOW:\?/)
    expect(read('.env.example')).toMatch(/^ADMIN_ALLOW=$/m)
  })
})

describe('Dockerfile', () => {
  const dockerfile = read('Dockerfile')
  const runner = dockerfile.slice(dockerfile.lastIndexOf('\nFROM '))

  it('builds on Node 26 with the pinned pnpm, installed by npm (no corepack on Node 25+)', () => {
    expect(dockerfile).toMatch(/^FROM docker\.io\/library\/node:26-alpine AS base$/m)
    expect(dockerfile).toContain(`npm i -g "$(node -p "require('./package.json').packageManager")"`)
    expect(dockerfile).not.toMatch(/^RUN .*corepack/im)
    // An exact pin, on the major pnpm-workspace.yaml is written for. Renovate moves the patch and
    // minor; a new major is a deliberate change that has to come through here.
    expect(JSON.parse(read('package.json')).packageManager).toMatch(/^pnpm@12\.\d+\.\d+$/)
    // pnpm reads its settings (the pin, the build allowlist, the release age, the overrides) only
    // from pnpm-workspace.yaml, so the image installs with it or with none of them.
    expect(dockerfile).toMatch(/^COPY package\.json pnpm-lock\.yaml pnpm-workspace\.yaml \.\/$/m)
  })

  it('runs the server as an unprivileged user', () => {
    expect(runner).toMatch(/^USER nextjs$/m)
    expect(runner).not.toMatch(/^USER root$/m)
  })

  it('ships the provisioning script', () => {
    expect(runner).toContain('scripts/create-admin.mjs')
  })

  // The seed reads the window captures from the working directory (/app), not from its bundle.
  it('ships the seed’s window captures, a directory that always exists', () => {
    expect(runner).toMatch(
      /^COPY --from=builder --chown=nextjs:nodejs \/app\/src\/seed\/windows \.\/src\/seed\/windows$/m,
    )
    expect(statSync('src/seed/windows/.gitkeep').isFile()).toBe(true)
    expect(read('.dockerignore')).not.toMatch(/^\/?src\b|^\*\*\/\*\.webp$/m)
  })
})
