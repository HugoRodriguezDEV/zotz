import type { ZotzFlowNode } from './zotz-flow-node-contract'

/** Node properties a template can read (spec §4.5). `json` takes a path into the JSON output. */
export const ZOTZ_FLOW_NODE_TEMPLATE_PROPERTIES = ['output', 'json', 'status', 'exitCode'] as const
export type ZotzFlowNodeTemplateProperty = (typeof ZOTZ_FLOW_NODE_TEMPLATE_PROPERTIES)[number]

type TemplateSpan = {
  /** Whole `{{ ... }}` as written. */
  raw: string
  start: number
  end: number
}

type TemplateExpression =
  | { root: 'trigger' | 'chat' | 'item'; path: string[] }
  | { root: 'node'; nodeName: string; property: ZotzFlowNodeTemplateProperty; path: string[] }

export type ZotzFlowTemplateRef = TemplateSpan & TemplateExpression

export type ZotzFlowTemplateIssueReason =
  | 'unclosed'
  | 'empty'
  | 'syntax'
  | 'missing_node_property'
  | 'unknown_node_property'
  | 'unexpected_path'

export type ZotzFlowTemplateIssue = TemplateSpan & { reason: ZotzFlowTemplateIssueReason }

export type ZotzFlowTemplateParse = {
  refs: ZotzFlowTemplateRef[]
  issues: ZotzFlowTemplateIssue[]
}

// Identifiers or array indexes, joined by dots: `listar.json.prs.0.title`.
const SEGMENT = /^(?:[A-Za-z_][A-Za-z0-9_]*|\d+)$/
const NODE_PROPERTIES = new Set<string>(ZOTZ_FLOW_NODE_TEMPLATE_PROPERTIES)

function isNodeProperty(value: string): value is ZotzFlowNodeTemplateProperty {
  return NODE_PROPERTIES.has(value)
}

/** Extracts references from `{{ ... }}` without resolving them; resolution belongs to the engine. */
export function parseZotzFlowTemplate(text: string): ZotzFlowTemplateParse {
  const refs: ZotzFlowTemplateRef[] = []
  const issues: ZotzFlowTemplateIssue[] = []
  let cursor = 0
  while (cursor < text.length) {
    const start = text.indexOf('{{', cursor)
    if (start === -1) {
      break
    }
    const close = text.indexOf('}}', start + 2)
    if (close === -1) {
      issues.push({ raw: text.slice(start), start, end: text.length, reason: 'unclosed' })
      break
    }
    const end = close + 2
    const span = { raw: text.slice(start, end), start, end }
    const parsed = parseExpression(text.slice(start + 2, close).trim())
    if ('reason' in parsed) {
      issues.push({ ...span, reason: parsed.reason })
    } else {
      refs.push({ ...span, ...parsed })
    }
    cursor = end
  }
  return { refs, issues }
}

type ParsedExpression = TemplateExpression | { reason: ZotzFlowTemplateIssueReason }

function parseExpression(expression: string): ParsedExpression {
  if (expression.length === 0) {
    return { reason: 'empty' }
  }
  const segments = expression.split('.')
  if (!segments.every((segment) => SEGMENT.test(segment)) || /^\d/.test(segments[0])) {
    return { reason: 'syntax' }
  }
  const [head, ...rest] = segments
  if (head === 'trigger' || head === 'chat' || head === 'item') {
    return { root: head, path: rest }
  }
  const [property, ...path] = rest
  if (property === undefined) {
    return { reason: 'missing_node_property' }
  }
  if (!isNodeProperty(property)) {
    return { reason: 'unknown_node_property' }
  }
  if (property !== 'json' && path.length > 0) {
    return { reason: 'unexpected_path' }
  }
  return { root: 'node', nodeName: head, property, path }
}

/** A node field that accepts templates, keyed so the engine and canvas name it the same way. */
export type ZotzFlowTemplateField = { field: string; text: string }

/** Every template-bearing field of a node. Command text is excluded: it never takes templates. */
export function getZotzFlowNodeTemplateFields(node: ZotzFlowNode): ZotzFlowTemplateField[] {
  switch (node.kind) {
    case 'agent':
      return [{ field: 'prompt', text: node.prompt }]
    case 'command':
      return node.env.map((entry) => ({ field: `env.${entry.name}`, text: entry.value }))
    case 'condition':
      return [
        { field: 'value', text: node.value },
        ...(node.compareTo === undefined ? [] : [{ field: 'compareTo', text: node.compareTo }])
      ]
    case 'switch':
      return [
        { field: 'value', text: node.value },
        ...node.cases.map((entry) => ({ field: `cases.${entry.port}`, text: entry.equals }))
      ]
    case 'approval':
      return [{ field: 'message', text: node.message }]
    case 'http':
      return [
        { field: 'url', text: node.url },
        ...node.headers.map((header) => ({ field: `headers.${header.name}`, text: header.value })),
        ...(node.body === undefined ? [] : [{ field: 'body', text: node.body }])
      ]
    case 'notify':
      return [
        { field: 'title', text: node.title },
        { field: 'body', text: node.body }
      ]
    case 'chat_reply':
      return [{ field: 'content', text: node.content }]
    case 'template':
      return [{ field: 'content', text: node.content }]
    case 'subflow':
      return Object.entries(node.inputs).map(([name, text]) => ({ field: `inputs.${name}`, text }))
    case 'for_each':
      return [{ field: 'items', text: node.items }]
    case 'parallel':
    case 'join':
    case 'wait':
      return []
  }
}
