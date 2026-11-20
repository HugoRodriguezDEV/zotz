import { describe, expect, it } from 'vitest'
import type {
  GitHubProjectField,
  GitHubProjectRow,
  GitHubProjectTable
} from '../../github/projects/project-types'
import { buildZotzTaskBoard, zotzTaskBoardColumnForStatus } from './zotz-task-board-columns'

const STATUS: GitHubProjectField = {
  kind: 'single-select',
  id: 'status',
  name: 'Status',
  dataType: 'SINGLE_SELECT',
  options: [
    { id: 'todo', name: 'Todo', color: 'GRAY' },
    { id: 'qa', name: 'QA', color: 'PURPLE' },
    { id: 'done', name: 'Done', color: 'GREEN' },
    { id: 'blocked', name: 'Blocked', color: 'RED' }
  ]
}

function row(
  id: string,
  url: string,
  status: string | null,
  extra: Partial<GitHubProjectRow['content']> = {},
  itemType: GitHubProjectRow['itemType'] = 'ISSUE'
): GitHubProjectRow {
  const option =
    STATUS.kind === 'single-select' ? STATUS.options.find((o) => o.id === status) : null
  return {
    id,
    itemType,
    content: {
      number: 1,
      title: id,
      body: null,
      url,
      state: 'OPEN',
      stateReason: null,
      isDraft: null,
      repository: 'acme/web',
      assignees: [],
      labels: [],
      parentIssue: null,
      issueType: null,
      ...extra
    },
    fieldValuesByFieldId: option
      ? {
          status: {
            kind: 'single-select',
            fieldId: 'status',
            optionId: option.id,
            name: option.name,
            color: option.color
          }
        }
      : {},
    updatedAt: '2026-11-19T00:00:00Z',
    position: 0
  }
}

function table(number: number, rows: GitHubProjectRow[]): GitHubProjectTable {
  return {
    project: {
      id: `project-${number}`,
      owner: 'acme',
      ownerType: 'organization',
      number,
      title: `Project ${number}`,
      url: `https://github.com/orgs/acme/projects/${number}`
    },
    selectedView: {
      id: 'view',
      number: 1,
      name: 'Board',
      layout: 'BOARD_LAYOUT',
      filter: '',
      fields: [STATUS],
      groupByFields: [],
      sortByFields: [],
      verticalGroupByFields: [STATUS]
    },
    rows,
    totalCount: rows.length,
    parentFieldDropped: false
  }
}

describe('zotzTaskBoardColumnForStatus', () => {
  it('matches by name, then synonyms, ignoring case, accents and dashes', () => {
    expect(zotzTaskBoardColumnForStatus('In progress')).toBe('in-progress')
    expect(zotzTaskBoardColumnForStatus('Todo')).toBe('backlog')
    expect(zotzTaskBoardColumnForStatus('Ready')).toBe('backlog')
    expect(zotzTaskBoardColumnForStatus('QA')).toBe('in-review')
    expect(zotzTaskBoardColumnForStatus('En revisión')).toBe('in-review')
    expect(zotzTaskBoardColumnForStatus('code-review')).toBe('in-review')
    expect(zotzTaskBoardColumnForStatus('Blocked')).toBeNull()
    expect(zotzTaskBoardColumnForStatus(null)).toBeNull()
  })
})

describe('buildZotzTaskBoard', () => {
  it('keeps the first copy of an issue that is on two projects', () => {
    const issue = 'https://github.com/acme/web/issues/1'
    const board = buildZotzTaskBoard(
      [table(1, [row('first', issue, 'todo')]), table(2, [row('second', issue, 'done')])],
      new Set()
    )
    expect(board.columns.backlog.map((item) => item.row.id)).toEqual(['first'])
    expect(board.columns.done).toEqual([])
  })

  it('folds a PR into the issue that links it', () => {
    const pr = 'https://github.com/acme/web/pull/9'
    const board = buildZotzTaskBoard(
      [
        table(1, [
          row('issue', 'https://github.com/acme/web/issues/1', 'qa', {
            linkedPullRequests: {
              pullRequests: [{ number: 9, title: 'Fix', url: pr }],
              totalCount: 1
            }
          }),
          row('pr', pr, 'qa', {}, 'PULL_REQUEST'),
          row('lonely-pr', 'https://github.com/acme/web/pull/10', 'qa', {}, 'PULL_REQUEST')
        ])
      ],
      new Set()
    )
    expect(board.columns['in-review'].map((item) => item.row.id)).toEqual(['issue', 'lonely-pr'])
  })

  it('hides archived tasks only while they stay in Done', () => {
    const done = 'https://github.com/acme/web/issues/1'
    const reopened = 'https://github.com/acme/web/issues/2'
    const board = buildZotzTaskBoard(
      [table(1, [row('done', done, 'done'), row('reopened', reopened, 'todo')])],
      new Set([done, reopened])
    )
    expect(board.columns.done).toEqual([])
    expect(board.archived.map((item) => item.row.id)).toEqual(['done'])
    expect(board.columns.backlog.map((item) => item.row.id)).toEqual(['reopened'])
  })

  it('puts unmatched or missing statuses in No Status', () => {
    const board = buildZotzTaskBoard(
      [
        table(1, [
          row('blocked', 'https://github.com/acme/web/issues/1', 'blocked'),
          row('unset', 'https://github.com/acme/web/issues/2', null)
        ])
      ],
      new Set()
    )
    expect(board.unmapped.map((item) => item.row.id)).toEqual(['blocked', 'unset'])
  })
})
