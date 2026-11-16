import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import {
  RichText as LexicalRichText,
  type JSXConvertersFunction,
} from '@payloadcms/richtext-lexical/react'

import { pageHref, projectHref, resolveLink, withLocale, type PublishedIndex } from '@/lib/links'

type LinkFields = {
  linkType?: 'custom' | 'internal'
  url?: string | null
  newTab?: boolean | null
  doc?: { relationTo?: string; value?: unknown } | null
}

/**
 * Where a link in rich text goes, in the visitor's language, or null. A custom link passes the
 * site's link rule (src/lib/links.ts); an internal one names a page or project by relationship.
 * Either way a site path must still name something public: a page unpublished since the text was
 * written loses its link and keeps its words.
 */
const hrefOf = (fields: LinkFields, locale: string, index: PublishedIndex): string | null => {
  if (fields.linkType === 'internal') {
    const target = fields.doc?.value
    const slug =
      target && typeof target === 'object' && 'slug' in target ? (target.slug as unknown) : null
    if (typeof slug !== 'string') return null
    if (fields.doc?.relationTo === 'pages' && index.pages.has(slug))
      return withLocale(locale, pageHref(slug))
    if (fields.doc?.relationTo === 'projects' && index.projects.has(slug))
      return withLocale(locale, projectHref(slug))
    return null
  }
  const href = resolveLink(fields.url, index)
  return href === null ? null : withLocale(locale, href)
}

type LinkConverter = NonNullable<ReturnType<JSXConvertersFunction>['link']>

const linkConverter = (locale: string, index: PublishedIndex): LinkConverter =>
  function RichTextLink({ node, nodesToJSX }) {
    const fields = node.fields as LinkFields
    const children = nodesToJSX({ nodes: node.children })
    const href = hrefOf(fields, locale, index)
    if (href === null) return <>{children}</>
    const external = /^https:/.test(href)
    return (
      <a
        href={href}
        {...(fields.newTab ? { target: '_blank' } : {})}
        {...(external || fields.newTab ? { rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </a>
    )
  }

/** Editor text in the system's type, at reading width (`.prose` in site.css). */
export function RichText({
  data,
  locale,
  index,
  className,
}: {
  data: SerializedEditorState | null | undefined
  locale: string
  /** What a site path may point at, so a link to an unpublished page is dropped. */
  index: PublishedIndex
  className?: string
}) {
  if (!data) return null
  const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
    ...defaultConverters,
    link: linkConverter(locale, index),
    autolink: linkConverter(locale, index) as NonNullable<
      ReturnType<JSXConvertersFunction>['autolink']
    >,
  })
  return (
    <LexicalRichText
      data={data}
      converters={converters}
      className={['prose', className].filter(Boolean).join(' ')}
    />
  )
}
