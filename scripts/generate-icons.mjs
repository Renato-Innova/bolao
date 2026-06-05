// Generates PWA icon SVG files for all required sizes
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const OUT = join(process.cwd(), 'public', 'icons')
mkdirSync(OUT, { recursive: true })

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

for (const size of SIZES) {
  const r = Math.round(size * 0.2)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0D1E3D"/>
      <stop offset="100%" stop-color="#020F2A"/>
    </linearGradient>
    <clipPath id="round">
      <rect width="${size}" height="${size}" rx="${r}" ry="${r}"/>
    </clipPath>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#bg)"/>
  <g clip-path="url(#round)">
    <rect width="${size}" height="${Math.round(size*0.025)}" fill="#4A90D9"/>
    <rect x="0" y="${Math.round(size*0.025)}" width="${size}" height="${Math.round(size*0.015)}" fill="#7BB8F0" opacity="0.4"/>
  </g>
  <text x="${size/2}" y="${Math.round(size*0.46)}" font-family="Arial Black,Arial,sans-serif" font-size="${Math.round(size*0.36)}" font-weight="900" fill="white" text-anchor="middle" dominant-baseline="middle">26</text>
  <text x="${size/2}" y="${Math.round(size*0.68)}" font-size="${Math.round(size*0.16)}" text-anchor="middle" dominant-baseline="middle">🏆</text>
  <text x="${size/2}" y="${Math.round(size*0.84)}" font-family="Arial,sans-serif" font-size="${Math.round(size*0.09)}" font-weight="700" fill="#4A90D9" text-anchor="middle" letter-spacing="2">FIFA</text>
  <text x="${size/2}" y="${Math.round(size*0.94)}" font-family="Arial,sans-serif" font-size="${Math.round(size*0.07)}" fill="rgba(255,255,255,0.35)" text-anchor="middle">WORLD CUP™</text>
</svg>`
  writeFileSync(join(OUT, `icon-${size}.svg`), svg)
  console.log(`✅ icon-${size}.svg`)
}
console.log('\nAll icons generated in public/icons/')
