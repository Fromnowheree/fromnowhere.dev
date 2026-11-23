import { getPayload } from 'payload'

import config from '../../src/payload.config.js'

/**
 * Playwright's global setup, in throwaway mode only (playwright.config.ts): puts Locals and
 * Giogio in service, as the editor will once their addresses answer.
 *
 * The seed starts both as building, because that is true of the launch (src/seed/index.ts). The
 * specs are about a station at work: running lines with their trains, a line with three stops,
 * a running line that becomes delayed. The server is up and seeded before this runs, and pages
 * render per request, so the change shows at once.
 */
export const IN_SERVICE = ['locals', 'giogio']

export default async function putInService(): Promise<void> {
  const payload = await getPayload({ config })
  const { docs, errors } = await payload.update({
    collection: 'projects',
    where: { slug: { in: IN_SERVICE } },
    data: { status: 'running' },
    depth: 0,
  })
  if (errors.length > 0 || docs.length !== IN_SERVICE.length) {
    throw new Error(
      `putInService: expected to set ${IN_SERVICE.join(' and ')} running, set ${docs.length}` +
        (errors.length > 0 ? ` (${errors.map((error) => error.message).join('; ')})` : ''),
    )
  }
  await payload.destroy()
}
