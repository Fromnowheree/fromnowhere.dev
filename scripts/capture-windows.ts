/**
 * Captures the windows: a phone-width picture (4:5) of each destination's first screen, in its
 * own look, for the seed to attach (src/seed/windowSeeds.ts, docs/phase-1.md "Windows").
 *
 *   pnpm capture:windows [--only=<slug>] [--source=<slug>=<url>] [--out=<dir>]
 *
 * Development only: it runs Playwright's Chromium on this machine, never in CI and never in the
 * image. `--out` defaults to src/seed/windows; `--source` captures a slug from another URL than
 * its address (and may be given once per slug).
 *
 * A window is an honest picture of a published destination. Read the checklist it prints, and
 * commit a capture only when every point holds.
 */
import { mkdirSync, statSync, unlinkSync } from 'node:fs'
import path from 'node:path'

import { chromium } from '@playwright/test'
import sharp from 'sharp'

import { WINDOWS, type WindowSeed } from '../src/seed/windowSeeds'

const WIDTH = 780
const HEIGHT = 976
const MAX_BYTES = 150 * 1024

type Options = { only?: string; sources: Map<string, string>; out: string }

function parseArgs(argv: string[]): Options {
  const options: Options = { sources: new Map(), out: path.resolve('src/seed/windows') }
  for (const arg of argv) {
    const [flag, ...rest] = arg.split('=')
    const value = rest.join('=')
    if (flag === '--only' && value) options.only = value
    else if (flag === '--out' && value) options.out = path.resolve(value)
    else if (flag === '--source' && value.includes('=')) {
      const [slug, ...url] = value.split('=')
      options.sources.set(slug!, url.join('='))
    } else {
      throw new Error(
        `Unknown argument "${arg}". Usage: pnpm capture:windows [--only=<slug>] [--source=<slug>=<url>] [--out=<dir>]`,
      )
    }
  }
  return options
}

async function capture(entry: WindowSeed, from: string, out: string): Promise<string> {
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({
      viewport: { width: WIDTH / 2, height: HEIGHT / 2 },
      deviceScaleFactor: 2,
      reducedMotion: 'reduce',
      colorScheme: entry.colorScheme,
      locale: 'en-GB',
    })
    const page = await context.newPage()
    await page.goto(from, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    if (entry.waitFor) await page.waitForSelector(entry.waitFor)
    await page.waitForTimeout(500)
    const shot = await page.screenshot()

    const file = path.join(out, entry.file)
    await sharp(shot)
      .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'top' })
      .webp({ quality: 80 })
      .toFile(file)
    const { size } = statSync(file)
    if (size > MAX_BYTES) {
      unlinkSync(file)
      throw new Error(
        `${entry.file} is ${Math.round(size / 1024)} KB, over the 150 KB limit; it was not kept.`,
      )
    }
    return `${file} (${WIDTH}×${HEIGHT}, ${Math.round(size / 1024)} KB)`
  } finally {
    await browser.close()
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const entries = WINDOWS.filter((entry) => !options.only || entry.slug === options.only)
  if (WINDOWS.length === 0) {
    console.log('Nothing to capture: src/seed/windowSeeds.ts lists no windows.')
    return
  }
  if (entries.length === 0) {
    console.log(
      `Nothing to capture: src/seed/windowSeeds.ts lists no window for "${options.only}".`,
    )
    return
  }

  mkdirSync(options.out, { recursive: true })
  for (const entry of entries) {
    const from = options.sources.get(entry.slug) ?? entry.source ?? entry.address
    console.log(`Capturing ${entry.slug} from ${from}…`)
    console.log(`  wrote ${await capture(entry, from, options.out)}`)
  }

  console.log(`
Before committing a capture, check by eye that:
  - the page is a real, published page, not a preview, demo or seed data;
  - it shows no one's personal details;
  - the client agreed, for a client's site;
  - the alt and caption in src/seed/windowSeeds.ts have been rewritten against the actual picture.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
