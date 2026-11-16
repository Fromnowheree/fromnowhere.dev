import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { statisticsScript } from '@/components/Analytics'
import config from '@/payload.config'
import { seed } from '@/seed'

let payload: Payload
let savedProfiles: { label: string; url: string; id?: string | null }[] = []

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await seed(payload)
  savedProfiles = (await payload.findGlobal({ slug: 'studio', depth: 0 })).profiles ?? []
})

afterAll(async () => {
  await payload.updateGlobal({ slug: 'studio', data: { profiles: savedProfiles } })
})

describe('profiles elsewhere', () => {
  const saveProfile = (url: string) =>
    payload.updateGlobal({ slug: 'studio', data: { profiles: [{ label: 'Somewhere', url }] } })

  it('take a full https address only, and the editor is told at save time', async () => {
    for (const bad of [
      'http://example.com',
      'javascript:alert(1)',
      'example.com',
      '/contact',
      'https://user:pass@example.com',
    ])
      await expect(saveProfile(bad), bad).rejects.toThrow()
    await expect(saveProfile('https://github.com/example')).resolves.toBeTruthy()
  })
})

describe('visitor statistics (decision 24)', () => {
  const env = { UMAMI_SCRIPT_URL: '/stats/script.js', UMAMI_WEBSITE_ID: 'abc' }

  it('are off on a new site', async () => {
    const studio = await payload.findGlobal({ slug: 'studio' })
    expect(studio.visitorStatistics).not.toBe(true)
    expect(statisticsScript(studio.visitorStatistics, env)).toBeNull()
  })

  it('load a script only with the setting on AND the installer’s script address and id', () => {
    expect(statisticsScript(true, env)).toEqual({ src: '/stats/script.js', websiteId: 'abc' })
    expect(statisticsScript(true, {})).toBeNull()
    expect(statisticsScript(true, { ...env, UMAMI_WEBSITE_ID: ' ' })).toBeNull()
    expect(statisticsScript(false, env)).toBeNull()
  })
})
