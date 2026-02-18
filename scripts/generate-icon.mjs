import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(__dirname, '..', 'src-tauri', 'icons')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5CC4E4"/>
      <stop offset="100%" stop-color="#3596B8"/>
    </linearGradient>
    <linearGradient id="page" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f7fbfd"/>
    </linearGradient>
  </defs>

  <!-- Background rounded square -->
  <rect width="512" height="512" rx="108" fill="url(#bg)"/>

  <!-- Subtle inner glow -->
  <rect x="8" y="8" width="496" height="496" rx="104" fill="none" stroke="white" stroke-opacity="0.1" stroke-width="2"/>

  <!-- Shadow under page -->
  <rect x="118" y="84" width="284" height="360" rx="18" fill="black" opacity="0.12"/>

  <!-- Notebook page -->
  <rect x="110" y="72" width="284" height="360" rx="18" fill="url(#page)"/>

  <!-- Page fold triangle -->
  <path d="M348 72 L394 118 L348 118 Z" fill="#e0f2f8"/>
  <path d="M348 72 L394 118" fill="none" stroke="#c4e4ef" stroke-width="1.5"/>

  <!-- Spine/binding line on left -->
  <line x1="140" y1="90" x2="140" y2="414" stroke="#c4e4ef" stroke-width="2.5" stroke-dasharray="4,6" opacity="0.6"/>

  <!-- Heading line (bold, cyan - like an H1) -->
  <rect x="160" y="128" width="130" height="14" rx="7" fill="#42B0D5" opacity="0.85"/>

  <!-- Body text lines -->
  <rect x="160" y="164" width="200" height="8" rx="4" fill="#b0bec5" opacity="0.5"/>
  <rect x="160" y="186" width="175" height="8" rx="4" fill="#b0bec5" opacity="0.5"/>
  <rect x="160" y="208" width="190" height="8" rx="4" fill="#b0bec5" opacity="0.5"/>

  <!-- Second heading (smaller, cyan) -->
  <rect x="160" y="248" width="90" height="12" rx="6" fill="#42B0D5" opacity="0.6"/>

  <!-- More body lines -->
  <rect x="160" y="278" width="185" height="8" rx="4" fill="#b0bec5" opacity="0.45"/>
  <rect x="160" y="300" width="160" height="8" rx="4" fill="#b0bec5" opacity="0.45"/>
  <rect x="160" y="322" width="170" height="8" rx="4" fill="#b0bec5" opacity="0.45"/>

  <!-- Checkbox items (like a task list) -->
  <rect x="160" y="356" width="10" height="10" rx="2" fill="none" stroke="#42B0D5" stroke-width="2" opacity="0.7"/>
  <rect x="180" y="357" width="100" height="8" rx="4" fill="#b0bec5" opacity="0.45"/>
  <rect x="160" y="378" width="10" height="10" rx="2" fill="#42B0D5" opacity="0.7"/>
  <path d="M162 383 L165 386 L169 380" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="180" y="379" width="120" height="8" rx="4" fill="#b0bec5" opacity="0.35"/>

  <!-- Lock icon (encryption badge) - bottom right -->
  <g transform="translate(336, 358)">
    <!-- Lock badge background -->
    <circle cx="28" cy="30" r="30" fill="#42B0D5"/>
    <circle cx="28" cy="30" r="28" fill="none" stroke="white" stroke-width="1.5" stroke-opacity="0.3"/>

    <!-- Lock body -->
    <rect x="14" y="28" width="28" height="22" rx="4" fill="white"/>

    <!-- Lock shackle -->
    <path d="M19 28 V22 A9 9 0 0 1 37 22 V28" fill="none" stroke="white" stroke-width="4" stroke-linecap="round"/>

    <!-- Keyhole -->
    <circle cx="28" cy="37" r="3.5" fill="#42B0D5"/>
    <rect x="26.5" y="37" width="3" height="6" rx="1.5" fill="#42B0D5"/>
  </g>
</svg>`

async function generateIcons() {
  // Generate 512x512 PNG
  const png512 = await sharp(Buffer.from(svg))
    .resize(512, 512)
    .png({ quality: 100 })
    .toBuffer()

  writeFileSync(join(iconsDir, 'icon.png'), png512)
  console.log('Generated icon.png (512x512)')

  // Generate multiple sizes for ICO
  const sizes = [256, 128, 64, 48, 32, 16]
  const pngBuffers = []

  for (const size of sizes) {
    const buf = await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toBuffer()
    pngBuffers.push({ size, data: buf })
  }

  // Build ICO file
  // ICO format: Header (6 bytes) + Directory entries (16 bytes each) + Image data
  const numImages = pngBuffers.length
  const headerSize = 6
  const dirEntrySize = 16
  const dirSize = dirEntrySize * numImages
  let dataOffset = headerSize + dirSize

  // Calculate total file size
  let totalSize = dataOffset
  for (const { data } of pngBuffers) {
    totalSize += data.length
  }

  const ico = Buffer.alloc(totalSize)
  let pos = 0

  // ICO Header
  ico.writeUInt16LE(0, pos); pos += 2      // Reserved
  ico.writeUInt16LE(1, pos); pos += 2      // Type (1 = ICO)
  ico.writeUInt16LE(numImages, pos); pos += 2 // Count

  // Directory entries
  let currentDataOffset = dataOffset
  for (const { size, data } of pngBuffers) {
    ico.writeUInt8(size >= 256 ? 0 : size, pos); pos += 1  // Width (0 = 256)
    ico.writeUInt8(size >= 256 ? 0 : size, pos); pos += 1  // Height (0 = 256)
    ico.writeUInt8(0, pos); pos += 1                         // Color palette
    ico.writeUInt8(0, pos); pos += 1                         // Reserved
    ico.writeUInt16LE(1, pos); pos += 2                      // Color planes
    ico.writeUInt16LE(32, pos); pos += 2                     // Bits per pixel
    ico.writeUInt32LE(data.length, pos); pos += 4            // Image data size
    ico.writeUInt32LE(currentDataOffset, pos); pos += 4      // Offset to image data
    currentDataOffset += data.length
  }

  // Image data
  for (const { data } of pngBuffers) {
    data.copy(ico, pos)
    pos += data.length
  }

  writeFileSync(join(iconsDir, 'icon.ico'), ico)
  console.log(`Generated icon.ico (${sizes.join(', ')}px)`)

  // Also generate a favicon for the web frontend
  const png32 = await sharp(Buffer.from(svg))
    .resize(32, 32)
    .png()
    .toBuffer()
  writeFileSync(join(__dirname, '..', 'public', 'favicon.png'), png32)
  console.log('Generated public/favicon.png (32x32)')
}

generateIcons().catch(console.error)
