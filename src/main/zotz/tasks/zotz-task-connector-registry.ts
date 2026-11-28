import type { Store } from '../../persistence/loading-store/store'
import type { ZotzTasksFormat } from '../../../shared/zotz/tasks/zotz-tasks-contract'
import {
  readZotzTaskConnectors,
  type ZotzTaskConnectorImportResult
} from '../../../shared/zotz/tasks/zotz-task-connector-types'
import type { ZotzTaskConnectorService } from './zotz-task-connector-service'

export type ZotzTaskSettingsStore = Pick<
  Store,
  'getSettings' | 'updateSettings' | 'onSettingsChanged'
>

// Electron-free on purpose: the runtime RPC and the CLI reach this module, so window updates
// come in as a callback from the desktop IPC instead of an Electron import.
let active: {
  service: ZotzTaskConnectorService
  store: ZotzTaskSettingsStore
  notifyChanged: () => void
} | null = null

export function setActiveZotzTaskConnectors(value: typeof active): void {
  active = value
}

/**
 * Imports a pushed zotz-tasks/v1 document (CLI or a paired client) as a file connector, adds it
 * to settings and tells open windows to reload the board.
 */
export async function pushZotzTasksDocument(
  text: string,
  format: ZotzTasksFormat | 'auto'
): Promise<ZotzTaskConnectorImportResult> {
  if (!active) {
    return { ok: false, error: 'The task board is not running in this Zotz' }
  }
  const result = await active.service.importDocument(text, format)
  if (result.ok) {
    const connectors = readZotzTaskConnectors(active.store.getSettings().zotzTaskConnectors)
    // Notify so open Settings and boards see the new connector without a reload.
    active.store.updateSettings(
      {
        zotzTaskConnectors: [
          ...connectors.filter((connector) => connector.id !== result.connector.id),
          result.connector
        ]
      },
      { notifyListeners: true }
    )
    active.notifyChanged()
  }
  return result
}

/** Re-reads URL feeds with no board open, so flows hear column moves; false when not running. */
export async function refreshZotzTaskFeeds(): Promise<boolean> {
  if (!active) {
    return false
  }
  const feeds = readZotzTaskConnectors(active.store.getSettings().zotzTaskConnectors).flatMap(
    (connector) =>
      connector.kind === 'url' && connector.url ? [{ id: connector.id, url: connector.url }] : []
  )
  if (feeds.length > 0) {
    await active.service.refresh(feeds)
  }
  return true
}
