import { useCallback } from 'react'
import { useAppStore } from '@/store/index'
import type { ZotzRoomPositions } from './zotz-agent-room-types'

// Rooms remembered at most; the least recently moved one is forgotten first.
const MAX_ROOMS = 50

/** Where a room's agents stand, saved in settings so it survives a restart. Null room: not saved. */
export function useZotzAgentRoomPositions(
  roomKey: string | null
): [ZotzRoomPositions | undefined, (positions: Record<string, [number, number]>) => void] {
  const saved = useAppStore((s) =>
    roomKey ? s.settings?.zotzAgentRoomPositions?.[roomKey] : undefined
  )
  const save = useCallback(
    (positions: Record<string, [number, number]>) => {
      if (!roomKey) {
        return
      }
      const rooms = Object.entries(
        useAppStore.getState().settings?.zotzAgentRoomPositions ?? {}
      ).filter(([key]) => key !== roomKey)
      void useAppStore.getState().updateSettings({
        zotzAgentRoomPositions: Object.fromEntries([
          ...rooms.slice(-(MAX_ROOMS - 1)),
          [roomKey, positions]
        ])
      })
    },
    [roomKey]
  )
  return [saved, save]
}
