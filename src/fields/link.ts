import type { PayloadRequest, TextFieldSingleValidation } from 'payload'

import { l, pickLabel } from '../i18n/label'
import { linkTarget } from '../lib/links'

const say = (req: PayloadRequest | undefined, en: string, hr: string) =>
  pickLabel(req?.i18n?.language, l(en, hr))

/**
 * The link rule (src/lib/links.ts) at save time, for a custom link inside rich text (Payload's
 * link feature), by shape only: Payload lets `javascript:` through on its own. An internal link
 * names its page or project by relationship and needs no check here. Whether a site path still
 * names something public is checked when the text renders (src/components/RichText.tsx), which
 * keeps the words and drops the link.
 */
export const richTextLinkRule: TextFieldSingleValidation = (value, args) => {
  if ((args.siblingData as { linkType?: string } | undefined)?.linkType === 'internal') return true
  if (linkTarget(value?.trim()) !== null) return true
  return say(
    args.req,
    'Use a page of this site without its language (e.g. /contact), or a full address starting with https://, mailto: or tel:.',
    'Upišite stranicu ovog weba bez oznake jezika (npr. /contact), ili punu adresu koja počinje s https://, mailto: ili tel:.',
  )
}

/** An absolute https:// address, for a project's addresses and profiles on other sites. */
export const httpsRule: TextFieldSingleValidation = (value, args) => {
  const address = value?.trim()
  if (!address) return args.required ? say(args.req, 'Enter an address.', 'Upišite adresu.') : true
  try {
    const url = new URL(address)
    if (url.protocol === 'https:' && url.hostname && !url.username && !url.password) return true
  } catch {
    // falls through to the message
  }
  return say(
    args.req,
    'Use a full address starting with https://, e.g. https://giogio.music.',
    'Upišite punu adresu koja počinje s https://, npr. https://giogio.music.',
  )
}
