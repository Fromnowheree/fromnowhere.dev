import { createNavigation } from 'next-intl/navigation'

import { routing } from './routing'

/** Locale-aware wrappers around next/link and next/navigation: `Link href="/contact"` renders
 * `/en/contact` on an English page. Site code links with these, never with next/link directly. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
