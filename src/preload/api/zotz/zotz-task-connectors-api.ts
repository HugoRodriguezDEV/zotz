import type {
  ZotzTaskConnectorImportResult,
  ZotzTaskConnectorSnapshot
} from '../../../shared/zotz/tasks/zotz-task-connector-types'

export type ZotzTaskConnectorsApi = {
  /** Last document of every connector, read from disk; no network. */
  snapshot: () => Promise<ZotzTaskConnectorSnapshot[]>
  /** Downloads these feeds now and returns every connector's state. */
  refresh: (connectors: { id: string; url: string }[]) => Promise<ZotzTaskConnectorSnapshot[]>
  /** Encrypts and stores the feed's bearer token; null clears it. False when the OS can't encrypt. */
  setToken: (id: string, token: string | null) => Promise<boolean>
  /** Opens a file picker and imports a zotz-tasks/v1 document. */
  importFile: () => Promise<ZotzTaskConnectorImportResult>
  remove: (id: string) => Promise<void>
}
