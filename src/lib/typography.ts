/* Small typographic fixes for text an editor types, applied at render time. They only swap
   ordinary spaces for no-break spaces (U+00A0), so the words and what a screen reader says stay
   the same; only where a line may break changes. */

const NBSP = ' '

/* A spaced dash ("Ponedjeljak – petak", "8:00 - 12:00") must never start a line: a line that
   begins with a dash reads as a list item or a minus sign. The space BEFORE the dash becomes a
   no-break space, so the dash stays with the word before it and a break can still fall after it.
   Hyphens inside words ("e-mail") have no space around them and are left alone. */
export function keepDashWithWord(text: string): string {
  return text.replace(/ +([–—-])(?= )/g, `${NBSP}$1`)
}

/* A range of numbers ("8:00 – 12:00") is read as one thing, so it stays on one line: both spaces
   around its dash become no-break spaces. A list of ranges ("8:00 – 12:00, 15:00 – 19:00") still
   breaks between them, after the comma. Any other spaced dash is left to keepDashWithWord. */
export function keepRangeTogether(text: string): string {
  return keepDashWithWord(text.replace(/(\d) +([–—-]) +(?=\d)/g, `$1${NBSP}$2${NBSP}`))
}

/* Croatian typesetting keeps a one-letter word (the conjunctions a, i, o, u and the prepositions
   k, s, v, z) on the same line as the word after it, so no line ends with a lone letter
   ("…pregled i / savjetovanje"). The space after such a word becomes a no-break space. The
   letter must stand alone (start of text, or after a space or an opening bracket or quote), so
   the last letter of a longer word is never matched. */
export function bindShortWords(text: string): string {
  return text.replace(/(?<=^|[\s(„"“'‘])([aikosuvz]) +/giu, `$1${NBSP}`)
}
