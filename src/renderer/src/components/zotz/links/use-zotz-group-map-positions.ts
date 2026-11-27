import { useCallback } from 'react'
import { useAppStore } from '@/store/index'
import type { ZotzGroupMapPositions } from './zotz-group-map-types'

/** Where a group's members stand on its map, saved in settings so it survives a restart. */
export function useZotzGroupMapPositions(
  groupId: string | null
): [ZotzGroupMapPositions | undefined, (positions: Record<string, [number, number]>) => void] {
  const saved = useAppStore((s) =>
    groupId ? s.settings?.zotzGroupMapPositions?.[groupId] : undefined
  )
  const save = useCallback(
    (positions: Record<string, [number, number]>) => {
      if (!groupId) {
        return
      }
      const settings = useAppStore.getState().settings
      // Drop maps of groups that no longer exist, so the setting doesn't grow forever.
      const live = new Set((settings?.zotzConversationLinks ?? []).map((group) => group.id))
      const kept = Object.entries(settings?.zotzGroupMapPositions ?? {}).filter(([id]) =>
        live.has(id)
      )
      void useAppStore.getState().updateSettings({
        zotzGroupMapPositions: { ...Object.fromEntries(kept), [groupId]: positions }
      })
    },
    [groupId]
  )
  return [saved, save]
}
