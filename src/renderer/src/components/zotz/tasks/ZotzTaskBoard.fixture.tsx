import { useAppStore } from '@/store/index'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import type {
  GitHubProjectField,
  GitHubProjectRow,
  GitHubProjectTable
} from '../../../../../shared/github/projects/project-types'
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

const TABLES: Record<number, GitHubProjectTable> = {
  1: table('acme', 1, 'Producto 2026', [
    row(142, 'acme/web', 'Login falla en Safari', 'doing', {
      labels: [{ name: 'bug', color: 'd73a4a' }],
      linkedPullRequests: {
        pullRequests: [
          { number: 534, title: 'Fix login', url: 'https://github.com/acme/web/pull/534' }
        ],
        totalCount: 1
      }
    }),
    row(150, 'acme/api', 'Paginar el endpoint de pacientes', 'todo'),
    row(151, 'acme/api', 'Rate limit por token', 'review', {
      labels: [{ name: 'backend', color: '1d76db' }]
    }),
    row(120, 'acme/web', 'Copiar enlace del plan', 'done')
  ]),
  7: table('zotz-labs', 7, 'Roadmap', [
    row(12, 'zotz-labs/zotz', 'Tablero de tareas', 'doing'),
    row(13, 'zotz-labs/zotz', 'Conector externo zotz-tasks/v1', 'todo')
  ])
}

function seedBoard(): void {
  useAppStore.setState((state) => ({
    settings: state.settings
      ? {
          ...state.settings,
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
  setup: seedBoard,
  render: () => <ZotzTaskBoard active />
})

export const detail = defineFixture({
  width: 1150,
  setup: seedBoard,
  render: () => <ZotzTaskBoard active />,
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
