// Colors the group map needs beyond the robots' own, read from the app's CSS tokens.

import { subscribeZotzSpriteTheme } from '../agent-sprite/zotz-agent-sprite-theme'

export type ZotzGroupMapTheme = {
  card: string
  border: string
  /** Ground shadow under each robot. */
  shadow: string
  /** Alpha of the floor's dot grid, drawn in the foreground color. */
  floorAlpha: number
  fontFamily: string
}

let cached: ZotzGroupMapTheme | null = null
let watching = false

function readTheme(): ZotzGroupMapTheme {
  const root = document.documentElement
  const styles = getComputedStyle(root)
  const token = (name: string, fallback: string): string =>
    styles.getPropertyValue(name).trim() || fallback
  const dark = root.classList.contains('dark')
  return {
    card: token('--card', dark ? '#171717' : '#ffffff'),
    border: token('--border', dark ? '#2e2e2e' : '#e5e5e5'),
    shadow: dark ? 'rgb(0 0 0 / 0.55)' : 'rgb(0 0 0 / 0.16)',
    floorAlpha: dark ? 0.06 : 0.07,
    fontFamily: getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif'
  }
}

export function zotzGroupMapTheme(): ZotzGroupMapTheme {
  if (!watching) {
    watching = true
    subscribeZotzSpriteTheme(() => {
      cached = null
    })
  }
  cached ??= readTheme()
  return cached
}
