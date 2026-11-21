import { useAppStore } from '@/store/index'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import type {
  GitHubProjectField,
  GitHubProjectRow,
  GitHubProjectTable
} from '../../../../../shared/github/projects/project-types'
import {
  DEFAULT_ZOTZ_TASK_BOARD_VIEW,
  type ZotzTaskBoardView
} from '../../../../../shared/zotz/tasks/zotz-task-board-views'
import { ZotzTaskBoard } from './ZotzTaskBoard'

const STATUS: GitHubProjectField = {
  kind: 'single-select',
  id: 'status',
  name: 'Status',
  dataType: 'SINGLE_SELECT',
  options: [
    { id: 'todo', name: 'Todo', color: 'GRAY' },
    { id: 'doing', name: 'In Progress', color: 'YELLOW' },
    { id: 'review', name: 'In Review', color: 'PURPLE' },
    { id: 'done', name: 'Done', color: 'GREEN' }
  ]
}

function row(
  number: number,
  repository: string,
  title: string,
  status: string,
  extra: Partial<GitHubProjectRow['content']> = {}
): GitHubProjectRow {
  const option =
    STATUS.kind === 'single-select' ? STATUS.options.find((o) => o.id === status) : null
  return {
    id: `${repository}#${number}`,
    itemType: 'ISSUE',
    content: {
      number,
      title,
      body: null,
      url: `https://github.com/${repository}/issues/${number}`,
      state: status === 'done' ? 'CLOSED' : 'OPEN',
      stateReason: null,
      isDraft: null,
      repository,
      assignees: [{ login: 'hugo', name: null, avatarUrl: null }],
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
    position: number
  }
}

/** Estimate and Start/Target dates, as a Project with those custom fields returns them. */
function withFields(
  base: GitHubProjectRow,
  estimate: number | null,
  start?: string,
  target?: string
): GitHubProjectRow {
  const values = { ...base.fieldValuesByFieldId }
  if (estimate !== null) {
    values.estimate = {
      kind: 'number',
      fieldId: 'estimate',
      number: estimate,
      fieldName: 'Estimate'
    }
  }
  if (start) {
    values.start = { kind: 'date', fieldId: 'start', date: start, fieldName: 'Start' }
  }
  if (target) {
    values.target = { kind: 'date', fieldId: 'target', date: target, fieldName: 'Target' }
  }
  return { ...base, fieldValuesByFieldId: values }
}

function table(owner: string, number: number, title: string, rows: GitHubProjectRow[]) {
  const data: GitHubProjectTable = {
    project: {
      id: `${owner}-${number}`,
      owner,
      ownerType: 'organization',
      number,
      title,
      url: `https://github.com/orgs/${owner}/projects/${number}`
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
  return data
}

const ANA = [{ login: 'ana', name: null, avatarUrl: null }]

const TABLES: Record<number, GitHubProjectTable> = {
  1: table('acme', 1, 'Producto 2026', [
    withFields(
      row(142, 'acme/web', 'Login falla en Safari', 'doing', {
        labels: [{ name: 'bug', color: 'd73a4a' }],
        linkedPullRequests: {
          pullRequests: [
            { number: 534, title: 'Fix login', url: 'https://github.com/acme/web/pull/534' }
          ],
          totalCount: 1
        }
      }),
      3,
      '2026-11-10',
      '2026-11-27'
    ),
    withFields(
      row(150, 'acme/api', 'Paginar el endpoint de pacientes', 'todo', { assignees: ANA }),
      5,
      '2026-12-01',
      '2026-12-19'
    ),
    withFields(
      row(151, 'acme/api', 'Rate limit por token', 'review', {
        labels: [{ name: 'backend', color: '1d76db' }],
        assignees: ANA
      }),
      2,
      '2026-11-16'
    ),
    withFields(
      row(120, 'acme/web', 'Copiar enlace del plan', 'done'),
      1,
      '2026-10-20',
      '2026-11-02'
    )
  ]),
  7: table('zotz-labs', 7, 'Roadmap', [
    withFields(
      row(12, 'zotz-labs/zotz', 'Tablero de tareas', 'doing'),
      8,
      '2026-11-03',
      '2027-01-15'
    ),
    withFields(
      row(13, 'zotz-labs/zotz', 'Conector externo zotz-tasks/v1', 'todo', { assignees: [] }),
      null
    )
  ])
}

function seedBoard(view?: Partial<ZotzTaskBoardView>): void {
  useAppStore.setState((state) => ({
    settings: state.settings
      ? {
          ...state.settings,
          zotzTaskBoardViews: view ? [{ ...DEFAULT_ZOTZ_TASK_BOARD_VIEW, ...view }] : undefined,
          zotzTaskBoardSources: [
            {
              kind: 'github-project',
              owner: 'acme',
              ownerType: 'organization',
              number: 1,
              title: 'Producto 2026'
            },
            {
              kind: 'github-project',
              owner: 'zotz-labs',
              ownerType: 'organization',
              number: 7,
              title: 'Roadmap'
            }
          ]
        }
      : state.settings,
    fetchProjectViewTable: async (_target, args) => ({
      ok: true,
      data: TABLES[args.projectNumber]
    })
  }))
}

export const combined = defineFixture({
  width: 1150,
  setup: () => seedBoard(),
  render: () => (
    <div className="flex h-[700px] flex-col">
      <ZotzTaskBoard active />
    </div>
  )
})

export const detail = defineFixture({
  width: 1150,
  setup: () => seedBoard(),
  render: () => (
    <div className="flex h-[700px] flex-col">
      <ZotzTaskBoard active />
    </div>
  ),
  interact: async (frame) => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const title = [...frame.querySelectorAll('button')].find(
        (button) => button.textContent === 'Login falla en Safari'
      )
      if (title) {
        title.click()
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  }
})

export const sums = defineFixture({
  width: 1150,
  setup: () => seedBoard({ sumField: 'Estimate', sliceBy: 'assignee' }),
  render: () => (
    <div className="flex h-[700px] flex-col">
      <ZotzTaskBoard active />
    </div>
  )
})

export const tableSums = defineFixture({
  width: 1150,
  setup: () => seedBoard({ layout: 'table', groupBy: 'project', sumField: 'Estimate' }),
  render: () => (
    <div className="flex h-[700px] flex-col">
      <ZotzTaskBoard active />
    </div>
  )
})

export const roadmap = defineFixture({
  width: 1150,
  setup: () => seedBoard({ layout: 'roadmap', sumField: 'Estimate', groupBy: 'project' }),
  render: () => (
    <div className="flex h-[700px] flex-col">
      <ZotzTaskBoard active />
    </div>
  )
})

export const projectSlice = defineFixture({
  width: 1150,
  setup: () =>
    seedBoard({
      scope: 'github.com/organization/acme/1',
      sumField: 'Estimate',
      sliceBy: 'assignee'
    }),
  render: () => (
    <div className="flex h-[700px] flex-col">
      <ZotzTaskBoard active />
    </div>
  ),
  interact: async (frame) => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const slice = [...frame.querySelectorAll('nav button')].find((button) =>
        button.textContent?.startsWith('ana')
      )
      if (slice instanceof HTMLElement) {
        slice.click()
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  }
})
