/**
 * Initialise Payload at server start so production migrations (and the optional seed) run before
 * the first request.
 *
 * If that fails in production (the database is not up yet, its login refuses, a migration fails),
 * the server ends. Next would carry on without it and Payload keeps the failure, so the health
 * check would answer 503 until someone restarted the container by hand; a restart policy never
 * restarts a container that is still running. That happens after a VPS reboot, when Docker starts
 * the containers in no particular order and the app can come up before Postgres. Ended, the
 * container is started again (compose.yml, `restart: unless-stopped`) until it succeeds, and the
 * cause is in `docker compose logs app`.
 *
 * Booted here with `cron: true`, this server also runs the status check every 5 minutes
 * (src/jobs/checkStatus.ts) unless STATUS_CHECKS is "off" (the end-to-end tests turn it off so
 * nothing on the network changes what they see).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { getPayload } = await import('payload')
  const { default: config } = await import('@payload-config')
  try {
    await getPayload({ config, cron: process.env.STATUS_CHECKS !== 'off' })
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') throw error
    console.error('Payload could not start, so the server ends and is started again.', error)
    process.exit(1)
  }
}
