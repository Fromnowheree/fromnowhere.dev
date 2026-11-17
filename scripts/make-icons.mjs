// The app icons, from the FNW mark in the night's colours (the header's lockup): the tile for
// iOS's home screen (src/app/apple-icon.png, 180px, no transparency), and the manifest's icons
// (public/icons/): 192px and 512px with rounded corners, and a maskable 512px whose mark sits in
// the middle 80%, which is all Android promises to show. Run again after the mark changes:
//
//   node scripts/make-icons.mjs
import sharp from 'sharp'

const tile = '#181c38'
const plate = '#eeedf6'
const point = '#a796ff'

/** The mark on a 64-unit grid (src/app/icon.svg), placed in `size` px with `pad` px around it. */
const mark = (size, { rounded, pad, background }) => {
  const scale = (size - pad * 2) / 64
  const corner = rounded ? size * 0.18 : 0
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${corner}" fill="${background}"/>
  <g transform="translate(${pad} ${pad}) scale(${scale})">
    <rect x="14" y="10" width="11" height="44" rx="1.5" fill="${plate}"/>
    <rect x="29" y="10" width="23" height="11" rx="1.5" fill="${plate}"/>
    <rect x="29" y="29" width="17" height="11" rx="1.5" fill="${plate}"/>
    <circle cx="34.5" cy="48.5" r="5.5" fill="${point}"/>
  </g>
</svg>`)
}

const png = (svg, file) => sharp(svg).png({ compressionLevel: 9 }).toFile(file)

await png(mark(180, { rounded: false, pad: 27, background: tile }), 'src/app/apple-icon.png')
await png(mark(192, { rounded: true, pad: 29, background: tile }), 'public/icons/icon-192.png')
await png(mark(512, { rounded: true, pad: 77, background: tile }), 'public/icons/icon-512.png')
// Maskable: full bleed, the mark inside the middle 80% (a 51px margin and more on every side).
await png(mark(512, { rounded: false, pad: 128, background: tile }), 'public/icons/maskable-512.png')
console.log('Wrote src/app/apple-icon.png and public/icons/*.png')
