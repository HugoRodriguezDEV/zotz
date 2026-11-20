import type { GitHubProjectOwnerType } from '../../github/projects/project-types'

/** A GitHub Project v2 the user chose to show on the Zotz task board. */
export type ZotzTaskBoardProjectSource = {
  kind: 'github-project'
  owner: string
  ownerType: GitHubProjectOwnerType
  number: number
  /** Title at selection time, shown while the project loads or when it fails. */
  title: string
  host?: string
}

export type ZotzTaskBoardSource = ZotzTaskBoardProjectSource

/** A task hidden from Done by "Archive finished"; it comes back if it leaves Done. */
export type ZotzTaskBoardArchivedTask = {
  key: string
  title: string
  archivedAt: number
}

/** Settings are hand-editable JSON: drop malformed entries instead of crashing the board. */
export function readZotzTaskBoardSources(value: unknown): ZotzTaskBoardSource[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(
    (entry): entry is ZotzTaskBoardSource =>
      typeof entry === 'object' &&
      entry !== null &&
      entry.kind === 'github-project' &&
      typeof entry.owner === 'string' &&
      (entry.ownerType === 'organization' || entry.ownerType === 'user') &&
      Number.isInteger(entry.number) &&
      typeof entry.title === 'string'
  )
}

export function readZotzTaskBoardArchived(value: unknown): ZotzTaskBoardArchivedTask[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(
    (entry): entry is ZotzTaskBoardArchivedTask =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof entry.key === 'string' &&
      typeof entry.title === 'string' &&
      typeof entry.archivedAt === 'number'
  )
}

export function zotzTaskBoardSourceKey(source: ZotzTaskBoardSource): string {
  return `${source.host ?? 'github.com'}/${source.ownerType}/${source.owner}/${source.number}`.toLowerCase()
}
