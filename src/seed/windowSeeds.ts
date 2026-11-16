/**
 * The windows the seed attaches (docs/phase-1.md, "Windows"): one committed capture per project,
 * taken with `pnpm capture:windows` (scripts/capture-windows.ts) into src/seed/windows/.
 *
 * A window is an honest picture of a published destination: never demo or seed data, never a
 * page that is not live, never a client's site without the client's agreement, and never anyone's
 * personal details. This file's name differs from the src/seed/windows/ directory on purpose, so
 * no import depends on whether a file or a directory resolves first.
 */
export type WindowSeed = {
  /** The project's slug. */
  slug: string
  /** The capture's file name inside the windows directory (`<windowsDir>/<file>`). */
  file: string
  /** One of the project's addresses: what the picture is OF. */
  address: string
  /** Where to capture from, when that differs from `address`. */
  source?: string
  /** The destination's primary look. */
  colorScheme: 'dark' | 'light'
  /** A selector to wait for before the capture. */
  waitFor?: string
  alt: { en: string; hr: string }
  /** Says what the picture shows and when it was taken. */
  caption: { en: string; hr: string }
}

/** Committed captures of published destinations. Empty until one is live (AGENTS.md, "Nothing is invented"). */
export const WINDOWS: WindowSeed[] = []
