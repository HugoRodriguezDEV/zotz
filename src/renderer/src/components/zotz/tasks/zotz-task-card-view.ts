import type {
  GitHubProjectLabel,
  GitHubProjectUser
} from '../../../../../shared/github/projects/project-types'
import type { ZotzTaskBoardItem } from '../../../../../shared/zotz/tasks/zotz-task-board-columns'

export type ZotzTaskCardView = {
  /** GitHub shows its mark; an external service shows its own logo and name. */
  brand: { kind: 'github' } | { kind: 'external'; name: string; logoUrl: string | null }
  ownerName: string
  ownerAvatarUrl: string | null
  projectTitle: string
  url: string | null
  /** "#142" for GitHub, the service's own id ("HD-142") otherwise. */
  numberLabel: string | null
  repository: string | null
  labels: GitHubProjectLabel[]
  assignees: GitHubProjectUser[]
  itemType: 'issue' | 'pr' | 'draft' | 'restricted'
}

/** GitHub serves every account's avatar at /<login>.png, so owners need no extra API call. */
export function githubOwnerAvatarUrl(owner: string, host?: string): string {
  return `https://${host ?? 'github.com'}/${encodeURIComponent(owner)}.png?size=40`
}

export function zotzTaskCardView(item: ZotzTaskBoardItem): ZotzTaskCardView {
  if (item.origin.kind === 'github') {
    const { row, project } = item.origin
    return {
      brand: { kind: 'github' },
      ownerName: project.owner,
      ownerAvatarUrl: githubOwnerAvatarUrl(project.owner, project.host),
      projectTitle: project.title,
      url: row.content.url ?? project.url,
      numberLabel: row.content.number == null ? null : `#${row.content.number}`,
      repository: row.content.repository,
      labels: row.content.labels,
      assignees: row.content.assignees,
      itemType:
        row.itemType === 'PULL_REQUEST'
          ? 'pr'
          : row.itemType === 'DRAFT_ISSUE'
            ? 'draft'
            : row.itemType === 'REDACTED'
              ? 'restricted'
              : 'issue'
    }
  }
  const { task, source } = item.origin
  const service = source.document.source
  return {
    brand: { kind: 'external', name: service.name, logoUrl: service.logoUrl ?? null },
    ownerName: service.name,
    ownerAvatarUrl: task.project?.avatarUrl ?? null,
    projectTitle: task.project?.name ?? service.name,
    url: task.url ?? service.url ?? null,
    numberLabel: task.id,
    repository: null,
    labels: task.labels.map((label) => ({ name: label.name, color: label.color ?? '' })),
    assignees: task.assignees.map((person) => ({
      login: person.login,
      name: person.name ?? null,
      avatarUrl: person.avatarUrl ?? null
    })),
    itemType: task.type === 'draft' ? 'draft' : 'issue'
  }
}
