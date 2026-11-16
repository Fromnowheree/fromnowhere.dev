import type { RichTextField } from 'payload'
import { richText } from 'payload/shared'

import { l, pickLabel } from '../i18n/label'
import { richTextFits } from '../lib/content'

/**
 * The size cap, then the editor's own checks (which run every link's rule, src/fields/link.ts):
 * a field-level validate replaces the editor's, so it has to be called here.
 */
export const richTextRule = ((value, args) => {
  if (!richTextFits(value))
    return pickLabel(
      args.req.i18n?.language,
      l(
        'This text is too long. Split it, or shorten it.',
        'Tekst je predug. Podijelite ga ili skratite.',
      ),
    )
  return richText(value, args)
}) satisfies RichTextField['validate']
