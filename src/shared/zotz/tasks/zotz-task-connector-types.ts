import type { ZotzTasksDocument, ZotzTasksRejectedTask } from './zotz-tasks-contract'

/** An external task service in settings. Its token, if any, lives encrypted in main, never here. */
export type ZotzTaskConnectorConfig = {
  id: string
  kind: 'url' | 'file'
  /** Name shown until the first document arrives; the document's source.name wins after that. */
  name: string
  url?: string
  hasToken?: boolean
}

export type ZotzTaskConnectorSnapshot = {
  id: string
  fetchedAt: number | null
  document: ZotzTasksDocument | null
  rejected: ZotzTasksRejectedTask[]
  error: string | null
}

export type ZotzTaskConnectorImportResult =
  | { ok: true; connector: ZotzTaskConnectorConfig; snapshot: ZotzTaskConnectorSnapshot }
  | { ok: false; error: string; canceled?: boolean }

export function readZotzTaskConnectors(value: unknown): ZotzTaskConnectorConfig[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(
    (entry): entry is ZotzTaskConnectorConfig =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof entry.id === 'string' &&
      (entry.kind === 'url' || entry.kind === 'file') &&
      typeof entry.name === 'string' &&
      (entry.kind === 'file' || typeof entry.url === 'string')
  )
}
