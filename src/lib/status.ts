import type { Project } from '@/payload-types'

/**
 * The live status of a line: what the editor set on the project, and what the status check
 * (src/jobs/checkStatus.ts) last heard from its addresses.
 *
 * Only a running line can be delayed: when its first address (where its line ends) has not
 * answered DOWN_AFTER checks in a row. One missed answer is a blip, not a delay. A check older
 * than STALE_MS says nothing (the job has stopped, or the address was just added), and then the
 * line shows what the editor set: nothing is invented for a visitor.
 */

/** The editor's status, plus the one the check adds. */
export type Service = Project['status'] | 'delayed'

/** What the check stores about one address (the `status-checks` collection). */
export type AddressCheck = {
  /** Checks in a row without an answer; 0 after an answer. */
  failures: number
  /** When it was last checked, as an ISO date. */
  checkedAt: string
}

/** Every 5 minutes; checks are trusted for six rounds. */
export const CHECK_EVERY_MINUTES = 5
export const STALE_MS = 30 * 60 * 1000
export const DOWN_AFTER = 2

/**
 * Whether an address answers: true or false from a fresh check, null when there is no fresh
 * check to go by.
 */
export const answers = (
  check: AddressCheck | undefined,
  now: number = Date.now(),
): boolean | null => {
  if (!check) return null
  const at = Date.parse(check.checkedAt)
  if (!Number.isFinite(at) || now - at > STALE_MS || at - now > STALE_MS) return null
  return check.failures < DOWN_AFTER
}

/** A project as the site shows it: with its live status and the addresses not answering. */
export type LiveProject = Project & {
  /** Absent where no check was consulted (tests, previews): the editor's status stands. */
  service?: Service
  /** Its addresses that are not answering right now, as written on the project. */
  unanswered?: string[]
}

/** The status a visitor sees. */
export const serviceOf = (project: LiveProject): Service => project.service ?? project.status

/** The project with its live status, from the checks by address. */
export const withService = (
  project: Project,
  checks: ReadonlyMap<string, AddressCheck>,
  now: number = Date.now(),
): LiveProject => {
  const addresses = (project.addresses ?? []).map((address) => address.url)
  const unanswered = addresses.filter((url) => answers(checks.get(url), now) === false)
  const terminalDown = addresses.length > 0 && unanswered.includes(addresses[0])
  return {
    ...project,
    service: project.status === 'running' && terminalDown ? 'delayed' : project.status,
    unanswered,
  }
}
