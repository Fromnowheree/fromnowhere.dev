import type { PayloadRequest, TextFieldSingleValidation, Where } from 'payload'

import { l, pickLabel } from '../i18n/label'
import { linkTarget, pageHref, projectHref, type LinkTarget } from '../lib/links'

const say = (req: PayloadRequest | undefined, en: string, hr: string) =>
  pickLabel(req?.i18n?.language, l(en, hr))

/** Whether a site path names a published page or project. */
const targetExists = async (
  target: Extract<LinkTarget, { kind: 'page' | 'project' }>,
  req: PayloadRequest,
) => {
  const where: Where = {
    and: [{ slug: { equals: target.slug } }, { _status: { equals: 'published' } }],
  }
  const { totalDocs } = await req.payload.count({
    collection: target.kind === 'page' ? 'pages' : 'projects',
    where,
    req,
  })
  return totalDocs > 0
}

/**
 * The link rule (src/lib/links.ts) at save time, so an editor is told now rather than finding the
 * link missing from the site: the shape first, then, for a site path, that it names something
 * public. The site checks again when it renders, so a page unpublished later hides the link
 * instead of leading to a 404.
 */
export const siteLinkRule: TextFieldSingleValidation = async (value, args) => {
  const link = value?.trim()
  if (!link) return args.required ? say(args.req, 'Enter a link.', 'Upišite poveznicu.') : true
  const target = linkTarget(link)
  if (target === null)
    return say(
      args.req,
      'Use a page of this site without its language (e.g. /contact, /projects/giogio, or / for the home page), or a full address starting with https://, mailto: or tel:.',
      'Upišite stranicu ovog weba bez oznake jezika (npr. /contact, /projects/giogio, ili / za početnu), ili punu adresu koja počinje s https://, mailto: ili tel:.',
    )
  if (target.kind !== 'page' && target.kind !== 'project') return true
  if (await targetExists(target, args.req)) return true
  const path = target.kind === 'page' ? pageHref(target.slug) : projectHref(target.slug)
  return say(
    args.req,
    `Nothing published has the address "${path}". Publish it first, or correct the link.`,
    `Ništa objavljeno nema adresu "${path}". Najprije to objavite ili ispravite poveznicu.`,
  )
}

/**
 * The same rule for a custom link inside rich text (Payload's link feature), by shape only: Payload
 * lets `javascript:` through on its own. An internal link names its page or project by
 * relationship and needs no check here. Whether a site path still names something public is
 * checked when the text renders (src/components/RichText.tsx), which keeps the words and drops
 * the link.
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
