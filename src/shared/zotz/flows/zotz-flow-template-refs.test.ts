import { describe, expect, it } from 'vitest'
import { parseZotzFlowTemplate } from './zotz-flow-template-refs'

describe('parseZotzFlowTemplate', () => {
  it('extracts node, trigger and item references with their positions', () => {
    const result = parseZotzFlowTemplate(
      'PR {{ trigger.pr.title }}: {{revisar.json.riesgo}} {{item.index}}'
    )
    expect(result.issues).toEqual([])
    expect(result.refs).toEqual([
      { raw: '{{ trigger.pr.title }}', start: 3, end: 25, root: 'trigger', path: ['pr', 'title'] },
      {
        raw: '{{revisar.json.riesgo}}',
        start: 27,
        end: 50,
        root: 'node',
        nodeName: 'revisar',
        property: 'json',
        path: ['riesgo']
      },
      { raw: '{{item.index}}', start: 51, end: 65, root: 'item', path: ['index'] }
    ])
  })

  it('reports malformed expressions instead of guessing', () => {
    const result = parseZotzFlowTemplate('{{revisar}} {{build.stdout}} {{a b}} {{open')
    expect(result.refs).toEqual([])
    expect(result.issues.map((issue) => [issue.raw, issue.reason])).toEqual([
      ['{{revisar}}', 'missing_node_property'],
      ['{{build.stdout}}', 'unknown_node_property'],
      ['{{a b}}', 'syntax'],
      ['{{open', 'unclosed']
    ])
  })
})
