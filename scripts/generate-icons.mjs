// Generates PWA PNG icons using only Node.js built-ins (no external deps)
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { deflateSync } from 'zlib'

const OUT = join(process.cwd(), 'public', 'icons')
mkdirSync(OUT, { recursive: true })

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

// ── PNG encoder ──────────────────────────────────────────────────────────────

function crc32(buf) {
  let c = 0xFFFFFFFF
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let v = i
      for (let j = 0; j < 8; j++) v = (v & 1) ? (0xEDB88320 ^ (v >>> 1)) : (v >>> 1)
      t[i] = v
    }
    return t
  })())
  for (const b of buf) c = table[(c ^ b) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const d = Buffer.from(data)
  const len = Buffer.alloc(4); len.writeUInt32BE(d.length)
  const crcData = Buffer.concat([t, d])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(crcData))
  return Buffer.concat([len, t, d, crc])
}

function makePNG(size) {
  // Draw icon pixel by pixel
  // Palette: bg=#020F2A  accent=#4A90D9  gold=#FFD700  text=white
  const bg    = [0x02, 0x0F, 0x2A, 0xFF]
  const card  = [0x0D, 0x1E, 0x3D, 0xFF]
  const blue  = [0x4A, 0x90, 0xD9, 0xFF]
  const gold  = [0xFF, 0xD7, 0x00, 0xFF]
  const white = [0xFF, 0xFF, 0xFF, 0xFF]

  const pixels = []
  const r = Math.round(size * 0.18)  // corner radius

  for (let y = 0; y < size; y++) {
    const row = []
    for (let x = 0; x < size; x++) {
      // Rounded corner mask
      const inCorner = (cx, cy) => {
        const dx = x - cx, dy = y - cy
        return dx * dx + dy * dy > r * r
      }
      const outside =
        (x < r && y < r && inCorner(r, r)) ||
        (x > size - 1 - r && y < r && inCorner(size - 1 - r, r)) ||
        (x < r && y > size - 1 - r && inCorner(r, size - 1 - r)) ||
        (x > size - 1 - r && y > size - 1 - r && inCorner(size - 1 - r, size - 1 - r))

      if (outside) { row.push(...[0, 0, 0, 0]); continue }

      // Top accent bar (3% height)
      if (y < size * 0.03) { row.push(...blue); continue }

      // Card background
      row.push(...card)

      // "26" text area — roughly centered top half
      const cx = size / 2, cy = size * 0.42
      const fw = size * 0.55, fh = size * 0.32

      // Simple block-letter "2" (left half)
      const lx = cx - fw / 2, rx = cx, ty = cy - fh / 2, by = cy + fh / 2
      const inLeft = x >= lx && x < rx && y >= ty && y <= by
      const inRight = x >= rx && x <= cx + fw / 2 && y >= ty && y <= by

      // Draw "2" shape (left block with curved top, diagonal middle, bottom bar)
      const strokeW = size * 0.06
      const in2 =
        // top bar of 2
        (y >= ty && y <= ty + strokeW && x >= lx && x <= lx + fw / 2) ||
        // right side top
        (x >= lx + fw / 2 - strokeW && x <= lx + fw / 2 && y >= ty && y <= cy) ||
        // middle diagonal bar
        (y >= cy - strokeW / 2 && y <= cy + strokeW / 2 && x >= lx && x <= lx + fw / 2) ||
        // left side bottom
        (x >= lx && x <= lx + strokeW && y >= cy && y <= by) ||
        // bottom bar of 2
        (y >= by - strokeW && y <= by && x >= lx && x <= lx + fw / 2)

      // Draw "6" shape (right block)
      const rx2 = rx, rx2w = fw / 2
      const in6 =
        // top bar
        (y >= ty && y <= ty + strokeW && x >= rx2 && x <= rx2 + rx2w) ||
        // left side full
        (x >= rx2 && x <= rx2 + strokeW && y >= ty && y <= by) ||
        // middle bar
        (y >= cy - strokeW / 2 && y <= cy + strokeW / 2 && x >= rx2 && x <= rx2 + rx2w) ||
        // right side bottom half
        (x >= rx2 + rx2w - strokeW && x <= rx2 + rx2w && y >= cy && y <= by) ||
        // bottom bar
        (y >= by - strokeW && y <= by && x >= rx2 && x <= rx2 + rx2w)

      if (in2 || in6) { row[row.length - 4] = white[0]; row[row.length - 3] = white[1]; row[row.length - 2] = white[2]; continue }

      // Trophy dot (gold circle)
      const tdx = x - cx, tdy = y - (size * 0.72)
      const tr = size * 0.08
      if (tdx * tdx + tdy * tdy <= tr * tr) { row[row.length - 4] = gold[0]; row[row.length - 3] = gold[1]; row[row.length - 2] = gold[2]; continue }

      // Bottom blue accent dots
      const bdots = [cx - size * 0.12, cx, cx + size * 0.12]
      for (const bx of bdots) {
        const ddx = x - bx, ddy = y - (size * 0.88)
        if (ddx * ddx + ddy * ddy <= (size * 0.025) ** 2) {
          row[row.length - 4] = blue[0]; row[row.length - 3] = blue[1]; row[row.length - 2] = blue[2]
          break
        }
      }
    }
    pixels.push(0, ...row)  // filter byte 0 = None
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  const raw = Buffer.from(pixels)
  const compressed = deflateSync(raw)

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))])
}

for (const size of SIZES) {
  const png = makePNG(size)
  const path = join(OUT, `icon-${size}.png`)
  writeFileSync(path, png)
  console.log(`✅ icon-${size}.png (${png.length} bytes)`)
}
console.log('\nAll PNG icons generated in public/icons/')
