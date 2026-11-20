import type { ZotzTasksDocument, ZotzTasksRejectedTask } from './zotz-tasks-contract'
import type { ZotzMatchedPullRequest } from './zotz-task-pr-matching'

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
  /** Actions the service answered a dry run for; only these are offered (§7.4). */
  verifiedActions: string[]
  /** Why a declared action is off, e.g. the dry run failed. */
  actionError: string | null
  /** Pull requests Zotz found for each task id, linked or only mentioning it. */
  pullRequests: Record<string, ZotzMatchedPullRequest[]>
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
