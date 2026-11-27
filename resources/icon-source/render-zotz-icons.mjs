#!/usr/bin/env node
// Render every Zotz icon from the pixel grids at integer cell scale; only the tile's rounded corners are antialiased.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  encodeIco,
  encodePng
} from '../../config/scripts/desktop-distribution/windows/trim-windows-icon-source.mjs'
import {
  BAT_WINGS_DOWN,
  BAT_WINGS_UP,
  COLORS,
  NIGHT_GRADIENT,
  batGrid,
  moonGrid,
  silhouetteRows
} from './zotz-bat-pixel.mjs'

const RESOURCES_DIR = join(import.meta.dirname, '..')
const ART_FILL = 0.78
const ART_MAX_FILL = 0.86
const TILE_RADIUS_RATIO = 0.22
// macOS grid: 824/1024 tile; Windows downscales ICO frames, so they fill ~96% (#5357).
const MAC_INSET_RATIO = 0.1
const WINDOWS_INSET_RATIO = 0.02
const ICO_FRAME_SIZES = [256, 128, 64, 48, 40, 32, 24, 20, 16]
const MAC_ICONSET = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024]
]
const BLUE_GRADIENT = { top: '#2f72db', bottom: '#123a7a' }
const WATERCOLOR_GRADIENT = { top: '#7a4eb2', bottom: '#e08a4c' }
const DEV_BADGE_COLOR = '#f26b1d'
const DEV_BADGE_LETTER = ['###..', '#..#.', '#...#', '#...#', '#...#', '#..#.', '###..']

const hex = (color) => [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16))

function createImage(size) {
  return { width: size, height: size, data: Buffer.alloc(size * size * 4) }
}

// Source-over blend so antialiased tile edges and badges composite correctly.
function blend(image, x, y, [r, g, b], alpha = 1) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height || alpha <= 0) {
    return
  }
  const i = (y * image.width + x) * 4
  const d = image.data
  const dstA = d[i + 3] / 255
  const outA = alpha + dstA * (1 - alpha)
  const mix = (src, dst) => Math.round((src * alpha + dst * dstA * (1 - alpha)) / outA)
  d[i] = mix(r, d[i])
  d[i + 1] = mix(g, d[i + 1])
  d[i + 2] = mix(b, d[i + 2])
  d[i + 3] = Math.round(outA * 255)
}

function insideRoundedRect(px, py, x0, y0, side, radius) {
  const cx = Math.min(Math.max(px, x0 + radius), x0 + side - radius)
  const cy = Math.min(Math.max(py, y0 + radius), y0 + side - radius)
  return (px - cx) ** 2 + (py - cy) ** 2 <= radius * radius
}

function paintTile(image, inset, gradient) {
  const side = image.width - inset * 2
  const radius = side * TILE_RADIUS_RATIO
  const top = hex(gradient.top)
  const bottom = hex(gradient.bottom)
  const samples = 4
  for (let y = 0; y < image.height; y++) {
    const t = Math.min(1, Math.max(0, (y + 0.5 - inset) / side))
    const color = top.map((c, i) => Math.round(c + (bottom[i] - c) * t))
    for (let x = 0; x < image.width; x++) {
      let hits = 0
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const px = x + (sx + 0.5) / samples
          const py = y + (sy + 0.5) / samples
          hits += insideRoundedRect(px, py, inset, inset, side, radius) ? 1 : 0
        }
      }
      blend(image, x, y, color, hits / samples ** 2)
    }
  }
}

function paintGrid(image, grid, left, top, cell, colorOf) {
  grid.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      const color = colorOf(ch)
      if (!color) {
        return
      }
      const rgb = hex(color)
      for (let y = 0; y < cell; y++) {
        for (let x = 0; x < cell; x++) {
          blend(image, left + c * cell + x, top + r * cell + y, rgb)
        }
      }
    })
  )
}

// Integer cell size near 78% of the tile, never above 86%.
function cellSizeFor(tileSide, cells) {
  let cell = Math.max(1, Math.round((tileSide * ART_FILL) / cells))
  while (cell > 1 && cell * cells > tileSide * ART_MAX_FILL) {
    cell--
  }
  return cell
}

/** Night tile with the moon, or the plain bat when the moon cannot fit at one pixel per cell. */
function renderTile(size, { insetRatio, gradient = NIGHT_GRADIENT, frame = BAT_WINGS_UP }) {
  const image = createImage(size)
  // 16 px has no room for an inset: the 16-cell bat needs the full width.
  const inset = size <= 16 ? 0 : size * insetRatio
  const tileSide = size - inset * 2
  paintTile(image, inset, gradient)
  const moonFits = 32 <= tileSide * ART_MAX_FILL
  const grid = moonFits ? moonGrid(frame) : batGrid(frame)
  const cell = moonFits ? cellSizeFor(tileSide, 32) : cellSizeFor(tileSide, 16)
  const offset = Math.round((size - cell * grid.length) / 2)
  paintGrid(image, grid, offset, offset, cell, (ch) => COLORS[ch])
  return image
}

function stampDevBadge(image) {
  const size = image.width
  const cell = Math.max(1, Math.floor(size / 64))
  const radius = cell * 7
  const cx = size - radius - Math.round(size * 0.04)
  const cy = cx
  const orange = hex(DEV_BADGE_COLOR)
  for (let y = cy - radius; y < cy + radius; y++) {
    for (let x = cx - radius; x < cx + radius; x++) {
      let hits = 0
      for (let s = 0; s < 16; s++) {
        const px = x + ((s % 4) + 0.5) / 4
        const py = y + (Math.floor(s / 4) + 0.5) / 4
        hits += (px - cx) ** 2 + (py - cy) ** 2 <= radius * radius ? 1 : 0
      }
      blend(image, x, y, orange, hits / 16)
    }
  }
  const letterWidth = DEV_BADGE_LETTER[0].length * cell
  const letterHeight = DEV_BADGE_LETTER.length * cell
  paintGrid(
    image,
    DEV_BADGE_LETTER,
    Math.round(cx - letterWidth / 2),
    Math.round(cy - letterHeight / 2),
    cell,
    (ch) => (ch === '#' ? '#ffffff' : null)
  )
  return image
}

// macOS template: black glyph with alpha; the eyes stay as holes.
function renderMenuBarTemplate(scale) {
  const width = 22 * scale
  const height = 14 * scale
  const image = { width, height, data: Buffer.alloc(width * height * 4) }
  const rows = silhouetteRows(BAT_WINGS_UP)
  const left = Math.round((width - rows[0].length * scale) / 2)
  const top = Math.round((height - rows.length * scale) / 2)
  paintGrid(image, rows, left, top, scale, (ch) => (ch === '#' ? '#000000' : null))
  return image
}

// One path of horizontal runs keeps the SVG small and pixel exact.
function gridToSvg(grid, colorOf) {
  const runsByColor = new Map()
  grid.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const color = colorOf(row[x])
      let end = x + 1
      while (end < row.length && colorOf(row[end]) === color) {
        end++
      }
      if (color) {
        const runs = runsByColor.get(color) ?? []
        runs.push(`M${x} ${y}h${end - x}v1h-${end - x}z`)
        runsByColor.set(color, runs)
      }
      x = end
    }
  })
  const width = grid[0].length
  const height = grid.length
  const paths = [...runsByColor]
    .map(([color, runs]) => `  <path fill="${color}" d="${runs.join('')}"/>`)
    .join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" shape-rendering="crispEdges">\n${paths}\n</svg>\n`
}

function write(path, buffer) {
  writeFileSync(path, buffer)
  console.log(`  -> ${relative(join(RESOURCES_DIR, '..'), path)}`)
}

function main() {
  const iconsetDir = process.argv[2]
  if (!iconsetDir) {
    console.error('Usage: render-zotz-icons.mjs <iconset-dir>')
    process.exit(1)
  }
  mkdirSync(iconsetDir, { recursive: true })
  for (const [name, size] of MAC_ICONSET) {
    writeFileSync(
      join(iconsetDir, name),
      encodePng(renderTile(size, { insetRatio: size <= 32 ? 0 : MAC_INSET_RATIO }))
    )
  }

  const mac = { insetRatio: MAC_INSET_RATIO }
  write(join(RESOURCES_DIR, 'build', 'icon.png'), encodePng(renderTile(1024, mac)))
  write(join(RESOURCES_DIR, 'icon.png'), encodePng(renderTile(256, mac)))
  write(join(RESOURCES_DIR, 'icon-dev.png'), encodePng(stampDevBadge(renderTile(256, mac))))
  write(
    join(RESOURCES_DIR, 'app-icons', 'orca-blue.png'),
    encodePng(renderTile(1024, { ...mac, gradient: BLUE_GRADIENT }))
  )
  write(
    join(RESOURCES_DIR, 'app-icons', 'orca-watercolor.png'),
    encodePng(renderTile(1024, { ...mac, gradient: WATERCOLOR_GRADIENT }))
  )

  const windows = { insetRatio: WINDOWS_INSET_RATIO }
  write(
    join(RESOURCES_DIR, 'build', 'icon.ico'),
    encodeIco(ICO_FRAME_SIZES.map((size) => renderTile(size, windows)))
  )
  write(join(RESOURCES_DIR, 'tray', 'zotz-tray-windows.png'), encodePng(renderTile(16, windows)))
  write(join(RESOURCES_DIR, 'tray', 'zotz-tray-windows@2x.png'), encodePng(renderTile(32, windows)))

  write(
    join(RESOURCES_DIR, 'tray', 'orca-menu-barTemplate.png'),
    encodePng(renderMenuBarTemplate(1))
  )
  write(
    join(RESOURCES_DIR, 'tray', 'orca-menu-barTemplate@2x.png'),
    encodePng(renderMenuBarTemplate(2))
  )

  // Renderer marks: white silhouette (CSS inverts it in light mode) and the two moon flap frames.
  write(
    join(RESOURCES_DIR, 'logo.svg'),
    gridToSvg(silhouetteRows(BAT_WINGS_UP), (ch) => (ch === '#' ? '#ffffff' : null))
  )
  write(
    join(RESOURCES_DIR, 'logo-moon.svg'),
    gridToSvg(moonGrid(BAT_WINGS_UP), (ch) => COLORS[ch] ?? null)
  )
  write(
    join(RESOURCES_DIR, 'logo-moon-wings-down.svg'),
    gridToSvg(moonGrid(BAT_WINGS_DOWN), (ch) => COLORS[ch] ?? null)
  )
}

main()
