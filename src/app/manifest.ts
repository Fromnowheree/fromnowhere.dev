import type { MetadataRoute } from 'next'

/**
 * The web app manifest: what a phone shows when the site is added to its home screen. The night's
 * colours (site.css: --night for the page, the tile's --surface-2 under the icons) and the icons
 * from scripts/make-icons.mjs. It opens at the bare address, which picks the visitor's language.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fromnowhere',
    short_name: 'FNW',
    description: 'Fromnowhere, a software studio: websites, products and the servers they run on.',
    start_url: '/',
    scope: '/',
    display: 'browser',
    background_color: '#05060f',
    theme_color: '#05060f',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
