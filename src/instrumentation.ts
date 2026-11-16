/**
 * Next's start hook. Everything it does is Node-only (Payload, migrations, the status check's
 * cron, `process.exit`), so it lives in instrumentation.node.ts, imported only in the Node
 * runtime: the Edge build of this file then contains none of it (Next's guidance; without the
 * split every dev compile warned about `process.exit` in the Edge Runtime).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { start } = await import('./instrumentation.node')
    await start()
  }
}
