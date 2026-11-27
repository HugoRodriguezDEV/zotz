// Zotz logo source of truth: pixel grids for the bat (16×16) and the bat in front of the moon (32×32).
// Cell codes: b bat body, e eye, f fang, m moon, n crater, d dark bat silhouette, . transparent.

const mirror = (half) => half.map((row) => row + [...row].toReversed().join(''))

export const BAT_WINGS_UP = mirror([
  '.....b..',
  'b....bb.',
  'bb...bbb',
  'bbb.bbeb',
  'bbbbbbbb',
  'bbbbbbbb',
  '.bb.bbbb',
  '..b..bbb',
  '......bb',
  '......f.'
])

export const BAT_WINGS_DOWN = mirror([
  '.....b..',
  '.....bb.',
  '.....bbb',
  '..bbbbeb',
  '.bbbbbbb',
  'bbbbbbbb',
  'bb.bbbbb',
  'b....bbb',
  '......bb',
  '......f.'
])

export const COLORS = {
  b: '#ece9ff',
  e: '#7ee0ff',
  f: '#ffffff',
  m: '#f6e8aa',
  n: '#e2d08c',
  d: '#2a2347'
}

export const NIGHT_GRADIENT = { top: '#2a2347', bottom: '#0f0d1a' }

/** Bat frame centered in a square grid of `size` cells. */
export function batGrid(frame = BAT_WINGS_UP, size = 16) {
  const top = Math.floor((size - frame.length) / 2)
  const left = Math.floor((size - frame[0].length) / 2)
  return Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => frame[r - top]?.[c - left] ?? '.').join('')
  )
}

/** 32×32 moon with two craters and the bat as a dark silhouette in front (eyes stay lit). */
export function moonGrid(frame = BAT_WINGS_UP) {
  const N = 32
  return Array.from({ length: N }, (_, r) =>
    Array.from({ length: N }, (_, c) => {
      const dx = c - 15.5
      const dy = r - 15.5
      if (dx * dx + dy * dy > 13.6 * 13.6) {
        return '.'
      }
      const cell = frame[r - 11]?.[c - 8]
      if (cell && cell !== '.') {
        return cell === 'e' ? 'e' : 'd'
      }
      const crater = (c - 12) ** 2 + (r - 11) ** 2 <= 4 || (c - 21) ** 2 + (r - 21) ** 2 <= 2
      return crater ? 'n' : 'm'
    }).join('')
  )
}

/** One-color silhouette rows (bat cells only, eyes become holes), cropped to the bat. */
export function silhouetteRows(frame = BAT_WINGS_UP) {
  return frame.map((row) => [...row].map((ch) => (ch === 'b' || ch === 'f' ? '#' : '.')).join(''))
}
