import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { Link } from '@/i18n/navigation'

/**
 * A link an editor wrote, once it has passed the link rule (src/lib/links.ts resolveLink): a site
 * path goes through the language-aware Link, so "/contact" opens /en/contact on an English page;
 * an https, mailto or tel address is a plain anchor, and an https one carries `noopener`.
 */
export function SiteLink({
  href,
  className,
  children,
  ...rest
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string
  children: ReactNode
} & Record<`data-${string}`, string | undefined>) {
  if (href.startsWith('/'))
    return (
      <Link href={href} className={className} {...rest}>
        {children}
      </Link>
    )
  return (
    <a
      href={href}
      className={className}
      {...(href.startsWith('https:') ? { rel: 'noopener noreferrer' } : {})}
      {...rest}
    >
      {children}
    </a>
  )
}
