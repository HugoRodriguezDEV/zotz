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

function mergeSnapshot(
  list: ZotzTaskConnectorSnapshot[],
  snapshot: ZotzTaskConnectorSnapshot
): ZotzTaskConnectorSnapshot[] {
  return [...list.filter((item) => item.id !== snapshot.id), snapshot]
}

/** External services' last documents, refreshed from the network while the board is visible. */
export function useZotzTaskConnectors(active: boolean): {
  states: ZotzTaskConnectorState[]
  refreshing: boolean
  refresh: () => void
  syncPullRequests: (repos: string[]) => void
  linkPullRequest: (connectorId: string, taskId: string, url: string) => void
  move: (connectorId: string, taskId: string, optionId: string) => Promise<string | null>
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

  const syncPullRequests = useCallback(
    (repos: string[]) => {
      const api = window.api?.zotzTaskConnectors
      if (api && connectors.length > 0) {
        void api.syncPullRequests(repos).then(
          (next) => (next.length > 0 ? setSnapshots(next) : undefined),
          () => undefined
        )
      }
    },
    [connectors.length]
  )

  const linkPullRequest = useCallback((connectorId: string, taskId: string, url: string) => {
    void window.api?.zotzTaskConnectors?.linkPullRequest(connectorId, taskId, url).then(
      (snapshot) => (snapshot ? setSnapshots((list) => mergeSnapshot(list, snapshot)) : undefined),
      () => undefined
    )
  }, [])

  /** Resolves to an error message, or null once the service accepted the move. */
  const move = useCallback(
    async (connectorId: string, taskId: string, optionId: string): Promise<string | null> => {
      const api = window.api?.zotzTaskConnectors
      if (!api) {
        return 'Unavailable'
      }
      const result = await api.move(connectorId, taskId, optionId)
      if (!result.ok) {
        return result.error
      }
      setSnapshots((list) => mergeSnapshot(list, result.snapshot))
      return null
    },
    []
  )

  useEffect(() => {
    const api = window.api?.zotzTaskConnectors
    const reload = (): void => {
      void api?.snapshot().then(setSnapshots, () => undefined)
    }
    reload()
    return api?.onChanged(reload)
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

  return { states, refreshing, refresh, syncPullRequests, linkPullRequest, move }
}
