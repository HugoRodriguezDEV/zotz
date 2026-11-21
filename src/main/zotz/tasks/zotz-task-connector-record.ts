import { readJsonFile } from '../zotz-json-file'
import type { ZotzTaskConnectorSnapshot } from '../../../shared/zotz/tasks/zotz-task-connector-types'

/** What the connectors file keeps per connector; the extra fields never leave main. */
export type StoredZotzConnector = ZotzTaskConnectorSnapshot & {
  /** actionsUrl + actions last checked with a dry run, so a change triggers a new check. */
  actionsChecked?: string
  /** Last link-pr state sent per task + PR, so only changes go out. */
  sentLinks?: Record<string, string>
  /** "taskId|prUrl" the user linked by hand from a mention. */
  manualLinks?: string[]
}

export async function readJsonRecord(path: string): Promise<Record<string, unknown>> {
  const value = await readJsonFile(path)
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {}
}

/** Fills fields older Zotz versions did not store. */
export function normalizeStoredZotzConnector(value: unknown): StoredZotzConnector | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    typeof value.id !== 'string' ||
    !('document' in value)
  ) {
    return null
  }
  const stored: Partial<StoredZotzConnector> = Object.fromEntries(Object.entries(value))
  return {
    id: value.id,
    fetchedAt: typeof stored.fetchedAt === 'number' ? stored.fetchedAt : null,
    document: stored.document ?? null,
    rejected: Array.isArray(stored.rejected) ? stored.rejected : [],
    error: typeof stored.error === 'string' ? stored.error : null,
    verifiedActions: Array.isArray(stored.verifiedActions) ? stored.verifiedActions : [],
    actionError: typeof stored.actionError === 'string' ? stored.actionError : null,
    pullRequests:
      typeof stored.pullRequests === 'object' && stored.pullRequests !== null
        ? stored.pullRequests
        : {},
    actionsChecked: stored.actionsChecked,
    sentLinks: stored.sentLinks ?? {},
    manualLinks: Array.isArray(stored.manualLinks) ? stored.manualLinks : []
  }
}

export function publicZotzConnectorSnapshot({
  actionsChecked: _checked,
  sentLinks: _sent,
  manualLinks: _manual,
  ...snapshot
}: StoredZotzConnector): ZotzTaskConnectorSnapshot {
  return snapshot
}
