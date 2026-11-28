// Theme colors the canvas painter needs, read from the app's CSS tokens and refreshed on theme switch.

export type ZotzSpriteTheme = {
  foreground: string
  muted: string
  bubble: string
  bubbleLine: string
  live: string
  monitoring: string
  question: string
  success: string
  unread: string
  danger: string
  amber: string
  pending: string
}

let cached: ZotzSpriteTheme | null = null
const listeners = new Set<() => void>()
let observer: MutationObserver | null = null

function readTheme(): ZotzSpriteTheme {
  const styles = getComputedStyle(document.documentElement)
  const token = (name: string, fallback: string): string =>
    styles.getPropertyValue(name).trim() || fallback
  return {
    foreground: token('--foreground', '#0a0a0a'),
    muted: token('--muted-foreground', '#696969'),
    bubble: token('--popover', '#ffffff'),
    bubbleLine: token('--muted-foreground', '#696969'),
    live: token('--zotz-working-wave', '#2563eb'),
    monitoring: token('--agent-working', '#eab308'),
    question: token('--agent-question', '#ea580c'),
    success: token('--color-emerald-500', '#10b981'),
    unread: token('--unread', '#3b82f6'),
    danger: token('--color-red-500', '#ef4444'),
    amber: token('--color-amber-500', '#f59e0b'),
    pending: token('--zotz-gh-pending', '#9a6700')
  }
}

export function zotzSpriteTheme(): ZotzSpriteTheme {
  cached ??= readTheme()
  return cached
}

/** Calls `onChange` after a theme switch (the app flips classes on <html>). */
export function subscribeZotzSpriteTheme(onChange: () => void): () => void {
  if (!observer) {
    observer = new MutationObserver(() => {
      cached = null
      listeners.forEach((listener) => listener())
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    })
  }
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}
