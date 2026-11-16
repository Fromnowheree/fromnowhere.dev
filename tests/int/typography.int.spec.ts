import { describe, expect, it } from 'vitest'

import { bindShortWords, keepDashWithWord, keepRangeTogether } from '@/lib/typography'

// The helpers only swap ordinary spaces for no-break spaces, so the property worth holding is
// where a line may break: a break can only fall at an ordinary space (or after a hyphen, which
// none of these touch). `lines` lists the pieces a browser could put at the start of a line.
const NBSP = ' '
const lineStarts = (text: string) => text.split(' ').filter(Boolean)

describe('keepDashWithWord', () => {
  it('never lets a line start with a spaced dash', () => {
    for (const text of ['Ponedjeljak – petak', 'Monday - Friday', 'Mon — Fri', '8:00 – 12:00']) {
      const result = keepDashWithWord(text)
      expect(lineStarts(result).some((piece) => /^[–—-]/.test(piece))).toBe(false)
      // The same characters, only the space before the dash changed.
      expect(result.replaceAll(NBSP, ' ')).toBe(text)
    }
  })

  it('still lets the line break after the dash, and leaves hyphenated words alone', () => {
    expect(lineStarts(keepDashWithWord('Ponedjeljak – petak'))).toEqual([
      `Ponedjeljak${NBSP}–`,
      'petak',
    ])
    expect(keepDashWithWord('e-mail and walk-in')).toBe('e-mail and walk-in')
  })
})

describe('keepRangeTogether', () => {
  it('keeps each range of times on one line and breaks only between ranges', () => {
    const result = keepRangeTogether('8:00 – 12:00, 15:00 – 19:00')
    expect(lineStarts(result)).toEqual([`8:00${NBSP}–${NBSP}12:00,`, `15:00${NBSP}–${NBSP}19:00`])
    expect(result.replaceAll(NBSP, ' ')).toBe('8:00 – 12:00, 15:00 – 19:00')
  })

  it('treats a dash that is not between numbers like keepDashWithWord does', () => {
    expect(lineStarts(keepRangeTogether('Closed – holidays'))).toEqual([
      `Closed${NBSP}–`,
      'holidays',
    ])
  })
})

describe('bindShortWords', () => {
  it('never leaves a one-letter Croatian word at the end of a line', () => {
    const text = 'Pregled i savjetovanje u Zagrebu, s vama a k nama, Z ili V, o tome (s njima)'
    const result = bindShortWords(text)
    const ends = lineStarts(result).map((piece) => piece.split(NBSP).at(-1))
    expect(ends.some((word) => /^[(„"]?[aikosuvz]$/i.test(word ?? ''))).toBe(false)
    expect(result.replaceAll(NBSP, ' ')).toBe(text)
  })

  it('leaves the last letter of a longer word alone', () => {
    expect(bindShortWords('Kava sa šećerom')).toBe('Kava sa šećerom')
    expect(bindShortWords('broj 5 i dalje')).toBe(`broj 5 i${NBSP}dalje`)
  })
})
