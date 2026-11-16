import type { MetadataRoute } from 'next'

import { serverUrl } from '@/lib/serverUrl'

// Rendered per request: a build-time render would bake in the build's SITE_URL, not the server's.
export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api'] },
    sitemap: `${serverUrl}/sitemap.xml`,
  }
}
