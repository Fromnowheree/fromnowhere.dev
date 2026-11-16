import type { Payload, TaskConfig } from 'payload'

import { isProbeable, probe, type ProbeResult } from '../lib/probe'
import { CHECK_EVERY_MINUTES } from '../lib/status'

/** How many addresses are knocked on at once. */
const AT_ONCE = 6

export type StatusCheckSummary = { checked: number; answered: number; removed: number }

/**
 * One round of the status check: knock on every address of every published project (each once,
 * however many projects share it), write what came back to `status-checks`, and remove the rows
 * of addresses no published project has any more. Exported for the tests, which hand it a
 * `probeImpl` instead of the network.
 */
export async function runStatusCheck(
  payload: Payload,
  {
    probeImpl = probe,
    now = () => new Date(),
  }: { probeImpl?: (address: string) => Promise<ProbeResult>; now?: () => Date } = {},
): Promise<StatusCheckSummary> {
  const { docs: projects } = await payload.find({
    collection: 'projects',
    where: { _status: { equals: 'published' } },
    depth: 0,
    limit: 99,
    pagination: false,
    select: { addresses: true },
  })
  const addresses = [
    ...new Set(projects.flatMap((project) => (project.addresses ?? []).map((a) => a.url))),
  ].filter(isProbeable)

  const { docs: rows } = await payload.find({
    collection: 'status-checks',
    depth: 0,
    limit: 1000,
    pagination: false,
  })
  const byUrl = new Map(rows.map((row) => [row.url, row]))

  const results: [string, ProbeResult][] = []
  for (let i = 0; i < addresses.length; i += AT_ONCE) {
    const batch = addresses.slice(i, i + AT_ONCE)
    results.push(
      ...(await Promise.all(
        batch.map(async (url) => [url, await probeImpl(url)] as [string, ProbeResult]),
      )),
    )
  }

  for (const [url, result] of results) {
    const checkedAt = now().toISOString()
    const previous = byUrl.get(url)
    const data = {
      url,
      answered: result.answered,
      code: result.code,
      ms: result.ms,
      failures: result.answered ? 0 : (previous?.failures ?? 0) + 1,
      checkedAt,
      answeredAt: result.answered ? checkedAt : (previous?.answeredAt ?? null),
    }
    if (previous) {
      await payload.update({ collection: 'status-checks', id: previous.id, data, depth: 0 })
    } else {
      await payload.create({ collection: 'status-checks', data, depth: 0 })
    }
  }

  const keep = new Set(addresses)
  const stale = rows.filter((row) => !keep.has(row.url))
  if (stale.length > 0) {
    await payload.delete({
      collection: 'status-checks',
      where: { id: { in: stale.map((row) => row.id) } },
    })
  }

  return {
    checked: results.length,
    answered: results.filter(([, result]) => result.answered).length,
    removed: stale.length,
  }
}

/**
 * The status check as a Payload job: scheduled every CHECK_EVERY_MINUTES minutes on the `status`
 * queue, which the server runs while STATUS_CHECKS is not "off" (src/instrumentation.ts,
 * `jobs.autoRun` in payload.config.ts). No retries: the next round is the retry.
 */
export const checkStatusTask: TaskConfig<'checkStatus'> = {
  slug: 'checkStatus',
  label: 'Status check',
  schedule: [{ cron: `0 */${CHECK_EVERY_MINUTES} * * * *`, queue: 'status' }],
  outputSchema: [
    { name: 'checked', type: 'number', required: true },
    { name: 'answered', type: 'number', required: true },
    { name: 'removed', type: 'number', required: true },
  ],
  handler: async ({ req }) => ({ output: await runStatusCheck(req.payload) }),
}
