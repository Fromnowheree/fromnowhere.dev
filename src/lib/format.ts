import type { Media } from '@/payload-types'

/** Upload fields are either an id or a populated doc; we only render populated ones. */
export const asMedia = (value: number | Media | null | undefined): Media | null =>
  value && typeof value === 'object' && value.url ? value : null

/** A line number as the board shows it: 1 → "01". */
export const lineNumber = (value: number | null | undefined): string =>
  String(value ?? 0).padStart(2, '0')
