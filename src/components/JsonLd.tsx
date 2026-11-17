/**
 * Structured data for search engines (schema.org, JSON-LD): a data block, not a script, so the
 * policy's nonce does not apply to it and React renders it without complaint. Every `<` is escaped,
 * so text from the CMS can never close the block ("</script>") and become markup.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify({ '@context': 'https://schema.org', ...data }).replace(
    /</g,
    '\\u003c',
  )
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}
