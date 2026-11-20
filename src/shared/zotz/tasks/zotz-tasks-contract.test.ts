import { describe, expect, it } from 'vitest'
import { buildZotzTaskBoard } from './zotz-task-board-columns'
import { parseZotzTasks } from './zotz-tasks-contract'

const JSON_FEED = `{
  "schema": "zotz-tasks/v1",
  "source": {
    "id": "acme-helpdesk",
    "name": "Acme Helpdesk",
    "fields": [
      {
        "name": "Status",
        "type": "single-select",
        "options": [
          { "id": "new", "name": "Nuevo", "category": "todo" },
          { "id": "qa", "name": "QA", "category": "in-progress" },
          { "id": "shipped", "name": "Entregado al cliente", "category": "done" }
        ]
      },
      { "name": "Prioridad", "type": "number" }
    ]
  },
  "tasks": [
    { "id": "HD-1", "title": "Login falla", "state": "open", "fieldValues": { "Status": "new", "Prioridad": 1 } },
    { "id": "HD-2", "title": "Exportar PDF", "state": "open", "fieldValues": { "Status": "qa" } },
    { "id": "HD-3", "title": "Cobro doble", "state": "closed", "fieldValues": { "Status": "shipped" } },
    { "id": "HD-4", "title": "Sin estado válido", "state": "open", "fieldValues": { "Status": "nope" } },
    { "id": "HD-5", "title": "", "state": "open", "fieldValues": { "Status": "new" } }
  ]
}`

const YAML_FEED = `schema: zotz-tasks/v1
source:
  id: acme-helpdesk
  name: Acme Helpdesk
  fields:
    - name: Status
      type: single-select
      options:
        - { id: new, name: Nuevo, category: todo }
tasks:
  - id: HD-1
    title: Login falla
    state: open
    fieldValues: { Status: new }
`

const TOML_FEED = `schema = "zotz-tasks/v1"

[source]
id = "acme-helpdesk"
name = "Acme Helpdesk"

[[source.fields]]
name = "Status"
type = "single-select"
options = [{ id = "new", name = "Nuevo", category = "todo" }]

[[tasks]]
id = "HD-1"
title = "Login falla"
state = "open"
fieldValues = { Status = "new" }
`

describe('parseZotzTasks', () => {
  it('keeps valid tasks and reports the bad ones without rejecting the feed', () => {
    const result = parseZotzTasks(JSON_FEED)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.document.tasks.map((task) => task.id)).toEqual(['HD-1', 'HD-2', 'HD-3'])
    expect(result.rejected.map((task) => task.id)).toEqual(['HD-4', 'HD-5'])
  })

  it('reads the same feed from JSON, YAML and TOML', () => {
    const ids = [YAML_FEED, TOML_FEED].map((text) => {
      const result = parseZotzTasks(text)
      return result.ok
        ? result.document.tasks.map((task) => [task.id, task.fieldValues.Status])
        : []
    })
    expect(ids).toEqual([[['HD-1', 'new']], [['HD-1', 'new']]])
  })

  it('rejects a feed without a Status field or with another schema version', () => {
    expect(
      parseZotzTasks(
        '{"schema":"zotz-tasks/v1","source":{"id":"a","name":"A","fields":[]},"tasks":[]}'
      ).ok
    ).toBe(false)
    expect(
      parseZotzTasks(
        '{"schema":"zotz-tasks/v2","source":{"id":"a","name":"A","fields":[]},"tasks":[]}'
      ).ok
    ).toBe(false)
  })

  it('places tasks by status name first and by category when the name says nothing', () => {
    const result = parseZotzTasks(JSON_FEED)
    if (!result.ok) {
      throw new Error(result.error)
    }
    const board = buildZotzTaskBoard([], new Set(), [
      { connectorId: 'acme', document: result.document }
    ])
    expect(board.columns.backlog.map((item) => item.key)).toEqual(['external:acme:HD-1'])
    expect(board.columns['in-review'].map((item) => item.key)).toEqual(['external:acme:HD-2'])
    expect(board.columns.done.map((item) => item.key)).toEqual(['external:acme:HD-3'])
  })
})
