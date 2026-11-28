import { useCallback, useState } from 'react'

export type ZotzFlowPanel = 'palette' | 'inspector'

const storageKey = (panel: ZotzFlowPanel): string => `zotz.flows.panel.${panel}`

function readOpen(panel: ZotzFlowPanel): boolean {
  try {
    return window.localStorage.getItem(storageKey(panel)) !== 'closed'
  } catch {
    // Storage can be blocked (private profile, quota); the panel just starts open.
    return true
  }
}

/** Open/closed side panel of the Flows page, remembered for this user on this machine. */
export function useZotzFlowPanelOpen(panel: ZotzFlowPanel): [boolean, () => void] {
  const [open, setOpen] = useState(() => readOpen(panel))
  const toggle = useCallback(() => {
    const next = !open
    setOpen(next)
    try {
      window.localStorage.setItem(storageKey(panel), next ? 'open' : 'closed')
    } catch {
      // Not remembered this time; the toggle still works.
    }
  }, [open, panel])
  return [open, toggle]
}
