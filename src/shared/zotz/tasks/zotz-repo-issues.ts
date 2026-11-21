import type {
  GitHubProjectField,
  GitHubProjectLabel,
  GitHubProjectRow,
  GitHubProjectTable,
  GitHubProjectUser
} from '../../github/projects/project-types'

/** An issue of a repo chosen without a Project, as main reads it from GitHub. */
export type ZotzRepoIssue = {
  number: number
  title: string
  url: string
  state: 'OPEN' | 'CLOSED'
  stateReason: string | null
  updatedAt: string
  labels: GitHubProjectLabel[]
  assignees: GitHubProjectUser[]
  /** Open PRs that will close it; turns an open issue into In Progress. */
  openClosingPullRequests: number
}

export type ZotzRepoIssues = {
  /** owner/name */
  repo: string
  url: string
  issues: ZotzRepoIssue[]
}

const STATUS_FIELD: Extract<GitHubProjectField, { kind: 'single-select' }> = {
  kind: 'single-select',
  id: 'zotz-repo-status',
  name: 'Status',
  dataType: 'SINGLE_SELECT',
  options: [
    { id: 'todo', name: 'Todo', color: 'GRAY' },
    { id: 'in-progress', name: 'In Progress', color: 'YELLOW' },
    { id: 'done', name: 'Done', color: 'GREEN' }
  ]
}

function statusOf(issue: ZotzRepoIssue): string {
  if (issue.state === 'CLOSED') {
    return 'done'
  }
  return issue.openClosingPullRequests > 0 ? 'in-progress' : 'todo'
}

/**
 * Turns a repo's issues into a Project-shaped table with a derived Status, the way GitHub's
 * default workflows would set it (§6.3), so the board treats repos and Projects alike.
 */
export function zotzRepoIssuesTable(source: ZotzRepoIssues): GitHubProjectTable {
  const [owner = '', name = ''] = source.repo.split('/')
  const rows: GitHubProjectRow[] = source.issues.map((issue, position) => {
    const optionId = statusOf(issue)
    const option = STATUS_FIELD.options.find((item) => item.id === optionId)
    return {
      id: `${source.repo}#${issue.number}`,
      itemType: 'ISSUE',
      content: {
        number: issue.number,
        title: issue.title,
        body: null,
        url: issue.url,
        state: issue.state,
        stateReason: issue.stateReason,
        isDraft: null,
        repository: source.repo,
        assignees: issue.assignees,
        labels: issue.labels,
        parentIssue: null,
        issueType: null
      },
      fieldValuesByFieldId: option
        ? {
            [STATUS_FIELD.id]: {
              kind: 'single-select',
              fieldId: STATUS_FIELD.id,
              optionId: option.id,
              name: option.name,
              color: option.color
            }
          }
        : {},
      updatedAt: issue.updatedAt,
      position
    }
  })
  return {
    project: {
      id: `zotz-repo:${source.repo.toLowerCase()}`,
      owner,
      ownerType: 'organization',
      number: 0,
      title: name,
      url: source.url
    },
    selectedView: {
      id: 'zotz-repo-view',
      number: 0,
      name: name,
      layout: 'BOARD_LAYOUT',
      filter: '',
      fields: [STATUS_FIELD],
      groupByFields: [],
      sortByFields: [],
      verticalGroupByFields: [STATUS_FIELD]
    },
    rows,
    totalCount: rows.length,
    parentFieldDropped: false
  }
}
