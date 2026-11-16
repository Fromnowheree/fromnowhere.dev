/**
 * Length and count caps for everything an editor writes into a page.
 *
 * Copied from NMT's `packages/portal-protocol/src/content.ts` (owned here; this repository never
 * depends on an @nmt package). There they bound what the appliance publishes to an untrusted host;
 * here they are the fields' `maxLength` / `maxRows`, so an editor is told at save time instead of
 * a page silently cutting their text. Keep the two in step only if the booking pages ever render
 * this site's content, which today they do not.
 */

/** A block's heading, a page title. */
export const MAX_HEADING_LENGTH = 300
/** The text under a heading: a hero's intro, a section's intro, a call to action's text. */
export const MAX_INTRO_LENGTH = 2000
/** A FAQ answer, a testimonial's quote, a team member's biography. */
export const MAX_PARAGRAPH_LENGTH = 5000
/** A short display string: a name, a button's text, a link's label, a FAQ question. */
export const MAX_LABEL_LENGTH = 300
/** One rich-text field, measured as UTF-8 JSON. */
export const MAX_RICH_TEXT_BYTES = 200 * 1024
/** Questions in a FAQ, testimonials in a block, photos in a gallery, rows in a list. */
export const MAX_BLOCK_ITEMS = 100
/** Blocks on one page. */
export const MAX_BLOCKS_PER_PAGE = 100
/** Links in one navigation list (header, footer quick links, legal links). */
export const MAX_NAV_LINKS = 50
/** An authored link (a project's address, a profile, a short link's target). */
export const MAX_LINK_LENGTH = 2048
/** A page's address segment. */
export const MAX_SLUG_LENGTH = 200

const utf8Length = (value: string) => new TextEncoder().encode(value).length

/** Whether a rich-text value fits MAX_RICH_TEXT_BYTES. Empty fits. */
export const richTextFits = (value: unknown): boolean =>
  value === null || value === undefined || utf8Length(JSON.stringify(value)) <= MAX_RICH_TEXT_BYTES
