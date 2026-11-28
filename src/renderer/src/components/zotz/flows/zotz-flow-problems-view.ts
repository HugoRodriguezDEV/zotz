import type { Translate } from '@/i18n/use-translate'
import {
  ZotzFlowDraftSchema,
  type ZotzFlowDraft
} from '../../../../../shared/zotz/flows/zotz-flow-contract'
import type {
  ZotzFlowProblem,
  ZotzFlowProblemCode
} from '../../../../../shared/zotz/flows/zotz-flow-problems'
import { validateZotzFlow } from '../../../../../shared/zotz/flows/zotz-flow-validation'

/** Graph problems from the contract plus field errors the schema finds (empty name, bad slug…). */
export type ZotzFlowCanvasProblem =
  | ZotzFlowProblem
  | {
      code: 'invalid_field'
      severity: 'error'
      message: string
      nodeId?: string
      edgeId?: undefined
      triggerId?: string
      field?: string
      params?: Record<string, string>
    }

export function collectZotzFlowProblems(draft: ZotzFlowDraft): ZotzFlowCanvasProblem[] {
  const problems: ZotzFlowCanvasProblem[] = validateZotzFlow(draft)
  const parsed = ZotzFlowDraftSchema.safeParse(draft)
  if (parsed.success) {
    return problems
  }
  for (const issue of parsed.error.issues) {
    const [section, index, ...rest] = issue.path
    const at =
      section === 'nodes' && typeof index === 'number'
        ? { nodeId: draft.nodes[index]?.id }
        : section === 'triggers' && typeof index === 'number'
          ? { triggerId: draft.triggers[index]?.id }
          : {}
    const field = (section === 'nodes' || section === 'triggers' ? rest : issue.path).join('.')
    problems.push({
      code: 'invalid_field',
      severity: 'error',
      message: issue.message,
      field,
      ...at
    })
  }
  return problems
}

const COPY: Record<ZotzFlowProblemCode, [string, string]> = {
  duplicate_node_id: ['zotz.flows.problem.duplicateNodeId', 'Two steps share the same id.'],
  duplicate_node_name: [
    'zotz.flows.problem.duplicateNodeName',
    'Another step is also named {name}.'
  ],
  reserved_node_name: ['zotz.flows.problem.reservedNodeName', '{name} is reserved for templates.'],
  parent_not_for_each: [
    'zotz.flows.problem.parentNotForEach',
    'A step can only sit inside a "for each" loop.'
  ],
  parent_cycle: ['zotz.flows.problem.parentCycle', 'Loops contain each other.'],
  edge_unknown_node: [
    'zotz.flows.problem.edgeUnknownNode',
    'Connection to a step that does not exist.'
  ],
  edge_unknown_port: ['zotz.flows.problem.edgeUnknownPort', '{name} has no "{port}" output.'],
  edge_crosses_loop: [
    'zotz.flows.problem.edgeCrossesLoop',
    'Connections cannot cross a loop border.'
  ],
  duplicate_edge: ['zotz.flows.problem.duplicateEdge', 'Duplicate connection.'],
  cycle: ['zotz.flows.problem.cycle', 'This step is part of a cycle.'],
  disconnected_node: ['zotz.flows.problem.disconnectedNode', 'This step is not connected.'],
  duplicate_switch_case: [
    'zotz.flows.problem.duplicateSwitchCase',
    'Output "{port}" is repeated or reserved.'
  ],
  for_each_empty: ['zotz.flows.problem.forEachEmpty', 'The loop has no steps inside.'],
  for_each_multiple_exits: [
    'zotz.flows.problem.forEachMultipleExits',
    'The loop body must end in a single step.'
  ],
  template_syntax: ['zotz.flows.problem.templateSyntax', 'Invalid template {template}.'],
  template_unknown_node: ['zotz.flows.problem.templateUnknownNode', '{template} names no step.'],
  template_not_before: [
    'zotz.flows.problem.templateNotBefore',
    '{template} reads a step that does not run before this one.'
  ],
  template_item_outside_loop: [
    'zotz.flows.problem.templateItemOutsideLoop',
    '{template} only works inside a "for each" loop.'
  ],
  template_unknown_chat_field: [
    'zotz.flows.problem.templateUnknownChatField',
    '{template} is not a chat field.'
  ],
  template_in_command: [
    'zotz.flows.problem.templateInCommand',
    'Pass values to a command through its variables, not its text.'
  ],
  chat_without_trigger: [
    'zotz.flows.problem.chatWithoutTrigger',
    'This needs a chat command trigger.'
  ],
  chat_context_not_requested: [
    'zotz.flows.problem.chatContextNotRequested',
    '{template} is empty unless the chat command sends it.'
  ]
}

export function describeZotzFlowProblem(problem: ZotzFlowCanvasProblem, t: Translate): string {
  if (problem.code === 'invalid_field') {
    return t('zotz.flows.problem.invalidField', 'Check the field "{field}".').replace(
      '{field}',
      () => problem.field || problem.message
    )
  }
  const [key, fallback] = COPY[problem.code]
  // Replacer functions: a literal replacement would expand `$` patterns in user text.
  return Object.entries(problem.params ?? {}).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, () => value),
    t(key, fallback)
  )
}

export type ZotzFlowProblemMarks = {
  nodes: Map<string, 'error' | 'warning'>
  edges: Map<string, 'error' | 'warning'>
  triggers: Map<string, 'error' | 'warning'>
}

export function markZotzFlowProblems(
  problems: readonly ZotzFlowCanvasProblem[]
): ZotzFlowProblemMarks {
  const marks: ZotzFlowProblemMarks = { nodes: new Map(), edges: new Map(), triggers: new Map() }
  const mark = (
    map: Map<string, 'error' | 'warning'>,
    id: string | undefined,
    severity: 'error' | 'warning'
  ): void => {
    if (id && map.get(id) !== 'error') {
      map.set(id, severity)
    }
  }
  for (const problem of problems) {
    if (problem.edgeId) {
      mark(marks.edges, problem.edgeId, problem.severity)
    } else {
      mark(marks.nodes, problem.nodeId, problem.severity)
    }
    if (problem.code === 'invalid_field') {
      mark(marks.triggers, problem.triggerId, problem.severity)
    }
  }
  return marks
}
