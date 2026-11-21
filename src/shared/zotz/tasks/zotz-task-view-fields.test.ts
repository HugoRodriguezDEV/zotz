import { describe, expect, it } from 'vitest'
import type { GitHubProjectRow, GitHubProjectTable } from '../../github/projects/project-types'
import { buildZotzTaskBoard } from './zotz-task-board-columns'
import { flattenZotzTaskBoard } from './zotz-task-board-views'
import { sumZotzTaskField, zotzTaskFieldCatalog } from './zotz-task-fields'
import { zotzTaskFacts, type ZotzTaskFacts } from './zotz-task-filter'
import { zotzTaskRoadmapDefaultFields, zotzTaskRoadmapSpan } from './zotz-task-roadmap'
import { matchesZotzTaskSlice, zotzTaskSlices } from './zotz-task-slices'
import { parseZotzTasks } from './zotz-tasks-contract'

const FEED = `{
  "schema": "zotz-tasks/v1",
  "source": {
    "id": "helpdesk",
    "name": "Helpdesk",
    "fields": [
      { "name": "Status", "type": "single-select", "options": [{ "id": "new", "name": "Todo" }] },
      { "name": "Estimate", "type": "number" },
      { "name": "Area", "type": "single-select", "options": [
        { "id": "web", "name": "Web", "color": "BLUE" },
        { "id": "api", "name": "API", "color": "GREEN" }
      ] },
      { "name": "Sprint", "type": "iteration", "iterations": [
        { "id": "s2", "title": "Sprint 2", "startDate": "2026-11-16", "duration": 14 },
        { "id": "s1", "title": "Sprint 1", "startDate": "2026-11-02", "duration": 14 }
      ] }
    ]
  },
  "tasks": [
    { "id": "HD-1", "title": "Login", "state": "open",
      "assignees": [{ "login": "ana" }, { "login": "hugo" }],
      "fieldValues": { "Status": "new", "Estimate": 5, "Area": "web", "Sprint": "s2" } },
    { "id": "HD-2", "title": "Export", "state": "open", "assignees": [{ "login": "hugo" }],
      "fieldValues": { "Status": "new", "Estimate": 2.5, "Area": "api", "Sprint": "s1" } },
    { "id": "HD-3", "title": "Billing", "state": "open",
      "fieldValues": { "Status": "new", "Area": "web" } }
  ]
}`

function githubRow(id: string, values: GitHubProjectRow['fieldValuesByFieldId']): GitHubProjectRow {
  return {
    id,
    itemType: 'ISSUE',
    content: {
      number: 7,
      title: id,
      body: null,
      url: `https://github.com/acme/web/issues/${id}`,
      state: 'OPEN',
      stateReason: null,
      isDraft: null,
      repository: 'acme/web',
      assignees: [{ login: 'ana', name: null, avatarUrl: null }],
      labels: [],
      parentIssue: null,
      issueType: null
    },
    fieldValuesByFieldId: values,
    updatedAt: '2026-11-19T00:00:00Z',
    position: 0
  }
}

const TABLE: GitHubProjectTable = {
  project: {
    id: 'p1',
    owner: 'acme',
    ownerType: 'organization',
    number: 1,
    title: 'Producto',
    url: 'https://github.com/orgs/acme/projects/1'
  },
  selectedView: {
    id: 'view',
    number: 1,
    name: 'Board',
    layout: 'BOARD_LAYOUT',
    filter: '',
    // "estimate" is only named by the view; the date carries its own field name.
    fields: [{ kind: 'field', id: 'f-estimate', name: 'estimate', dataType: 'NUMBER' }],
    groupByFields: [],
    sortByFields: []
  },
  rows: [
    githubRow('gh-1', {
      'f-estimate': { kind: 'number', fieldId: 'f-estimate', number: 3 },
      'f-start': { kind: 'date', fieldId: 'f-start', date: '2026-11-10', fieldName: 'Start date' },
      'f-target': {
        kind: 'date',
        fieldId: 'f-target',
        date: '2026-11-03',
        fieldName: 'Target date'
      }
    })
  ],
  totalCount: 1,
  parentFieldDropped: false
}

function loadBoard(): {
  facts: Map<string, ZotzTaskFacts>
  items: ReturnType<typeof flattenZotzTaskBoard>
} {
  const parsed = parseZotzTasks(FEED)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }
  const board = buildZotzTaskBoard([TABLE], new Set(), [
    { connectorId: 'c1', document: parsed.document }
  ])
  const items = flattenZotzTaskBoard(board)
  const facts = new Map(
    items.map((item) => [
      item.key,
      zotzTaskFacts(item, item.origin.kind === 'github' ? TABLE : undefined)
    ])
  )
  return { facts, items }
}

describe('zotz task view fields', () => {
  it('sums a number field across GitHub and services by name, skipping tasks without it', () => {
    const { facts } = loadBoard()
    const all = [...facts.values()].map((entry) => entry.fields)
    expect(sumZotzTaskField(all, 'Estimate')).toBe(10.5)
    expect(sumZotzTaskField(all, 'Nope')).toBe(0)
    expect(zotzTaskFieldCatalog(all)).toEqual([
      { name: 'Area', type: 'single-select' },
      { name: 'Estimate', type: 'number' },
      { name: 'Sprint', type: 'iteration' },
      { name: 'Start date', type: 'date' },
      { name: 'Target date', type: 'date' }
    ])
  })

  it('slices by assignee with a task in each of its assignees and "no value" last', () => {
    const { facts, items } = loadBoard()
    expect(zotzTaskSlices(items, facts, 'assignee')).toEqual([
      { value: 'ana', count: 2, color: null },
      { value: 'hugo', count: 2, color: null },
      { value: null, count: 1, color: null }
    ])
    const billing = items.find((item) => item.title === 'Billing')
    expect(billing && matchesZotzTaskSlice(billing, facts.get(billing.key), 'assignee', null)).toBe(
      true
    )
  })

  it('slices by a source field: options keep their color, iterations go by start date', () => {
    const { facts, items } = loadBoard()
    expect(zotzTaskSlices(items, facts, 'field:area')).toEqual([
      { value: 'API', count: 1, color: 'GREEN' },
      { value: 'Web', count: 2, color: 'BLUE' },
      { value: null, count: 1, color: null }
    ])
    expect(zotzTaskSlices(items, facts, 'field:Sprint').map((slice) => slice.value)).toEqual([
      'Sprint 1',
      'Sprint 2',
      null
    ])
  })

  it('places roadmap bars from dates or an iteration', () => {
    const { facts, items } = loadBoard()
    const github = facts.get(items.find((item) => item.title === 'gh-1')?.key ?? '')
    const login = facts.get(items.find((item) => item.title === 'Login')?.key ?? '')
    // Reversed dates still make a bar: Nov 3 through Nov 10.
    expect(zotzTaskRoadmapSpan(github?.fields ?? {}, 'Start date', 'Target date')).toEqual({
      startMs: Date.UTC(2026, 10, 3),
      endMs: Date.UTC(2026, 10, 11),
      point: false
    })
    expect(zotzTaskRoadmapSpan(github?.fields ?? {}, 'Start date', null)).toEqual({
      startMs: Date.UTC(2026, 10, 10),
      endMs: Date.UTC(2026, 10, 11),
      point: true
    })
    expect(zotzTaskRoadmapSpan(login?.fields ?? {}, 'Sprint', null)).toEqual({
      startMs: Date.UTC(2026, 10, 16),
      endMs: Date.UTC(2026, 10, 30),
      point: false
    })
    expect(zotzTaskRoadmapSpan(login?.fields ?? {}, 'Start date', 'Target date')).toBeNull()
  })

  it('picks roadmap fields by name when the view has none', () => {
    expect(
      zotzTaskRoadmapDefaultFields([
        { name: 'Due', type: 'date' },
        { name: 'Sprint', type: 'iteration' },
        { name: 'Kickoff', type: 'date' }
      ])
    ).toEqual({ start: 'Kickoff', end: 'Due' })
    expect(zotzTaskRoadmapDefaultFields([{ name: 'Sprint', type: 'iteration' }])).toEqual({
      start: 'Sprint',
      end: null
    })
  })
})
