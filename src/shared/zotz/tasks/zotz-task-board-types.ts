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

/** A repo whose issues show up even though they are in no Project. */
export type ZotzTaskBoardRepoSource = {
  kind: 'github-repo'
  owner: string
  ownerType: GitHubProjectOwnerType
  /** owner/name */
  repo: string
}

export type ZotzTaskBoardSource = ZotzTaskBoardProjectSource | ZotzTaskBoardRepoSource

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
      typeof entry.owner === 'string' &&
      (entry.ownerType === 'organization' || entry.ownerType === 'user') &&
      ((entry.kind === 'github-project' &&
        Number.isInteger(entry.number) &&
        typeof entry.title === 'string') ||
        (entry.kind === 'github-repo' &&
          typeof entry.repo === 'string' &&
          /^[\w.-]+\/[\w.-]+$/.test(entry.repo)))
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
  return source.kind === 'github-repo'
    ? `github.com/repo/${source.repo}`.toLowerCase()
    : `${source.host ?? 'github.com'}/${source.ownerType}/${source.owner}/${source.number}`.toLowerCase()
}

/** "acme / Producto 2026" for a Project, "acme/api" for a repo. */
export function zotzTaskBoardSourceLabel(source: ZotzTaskBoardSource): string {
  return source.kind === 'github-repo' ? source.repo : `${source.owner} / ${source.title}`
}
