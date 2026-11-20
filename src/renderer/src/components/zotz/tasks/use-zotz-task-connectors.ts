import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store/index'
import {
  readZotzTaskConnectors,
  type ZotzTaskConnectorConfig,
  type ZotzTaskConnectorSnapshot
} from '../../../../../shared/zotz/tasks/zotz-task-connector-types'

export type ZotzTaskConnectorState = {
  connector: ZotzTaskConnectorConfig
  snapshot: ZotzTaskConnectorSnapshot | null
}

/** External services' last documents, refreshed from the network while the board is visible. */
export function useZotzTaskConnectors(active: boolean): {
  states: ZotzTaskConnectorState[]
  refreshing: boolean
  refresh: () => void
} {
  const raw = useAppStore((s) => s.settings?.zotzTaskConnectors)
  const connectors = useMemo(() => readZotzTaskConnectors(raw), [raw])
  const [snapshots, setSnapshots] = useState<ZotzTaskConnectorSnapshot[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(() => {
    const api = window.api?.zotzTaskConnectors
    if (!api) {
      return
    }
    // Imported files have no URL; their last document comes back from the snapshot as is.
    const feeds = connectors.flatMap((connector) =>
      connector.kind === 'url' && connector.url ? [{ id: connector.id, url: connector.url }] : []
    )
    setRefreshing(true)
    void (feeds.length > 0 ? api.refresh(feeds) : api.snapshot())
      .then(setSnapshots, () => undefined)
      .finally(() => setRefreshing(false))
  }, [connectors])

  useEffect(() => {
    void window.api?.zotzTaskConnectors?.snapshot().then(setSnapshots, () => undefined)
  }, [])

  useEffect(() => {
    if (active) {
      refresh()
    }
  }, [active, refresh])

  const states = useMemo(() => {
    const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]))
    return connectors.map((connector) => ({
      connector,
      snapshot: byId.get(connector.id) ?? null
    }))
  }, [connectors, snapshots])

  return { states, refreshing, refresh }
}
