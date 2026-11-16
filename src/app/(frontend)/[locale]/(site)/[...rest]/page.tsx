import { notFound } from 'next/navigation'

/**
 * Every address under a language that no other route takes (two segments or more:
 * /hr/a/b, /en/projects/giogio/extra). Without it Next answers those with its own bare 404 page
 * (white, no language, no header) from the root, because a not-found.tsx only catches
 * `notFound()` from a route that matched. Here it matches, inside the site's layout, and the
 * site's own 404 (./not-found.tsx) answers in the page's language. `[slug]` and
 * `projects/[slug]` are more specific and still win.
 */
export default function Unknown(): never {
  notFound()
}
