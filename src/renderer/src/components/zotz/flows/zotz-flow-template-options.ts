import type { ZotzFlowDraft } from '../../../../../shared/zotz/flows/zotz-flow-contract'
import type {
  ZotzFlowNode,
  ZotzFlowOutputFormat
} from '../../../../../shared/zotz/flows/zotz-flow-node-contract'
import { ZOTZ_FLOW_CHAT_TEMPLATE_KEYS } from '../../../../../shared/zotz/flows/zotz-flow-run-contract'
import type { ZotzFlowTrigger } from '../../../../../shared/zotz/flows/zotz-flow-trigger-contract'
import { createZotzFlowTemplateScope } from '../../../../../shared/zotz/flows/zotz-flow-validation'

export type ZotzFlowTemplateGroup = 'trigger' | 'chat' | 'item' | 'node'

export type ZotzFlowTemplateOption = {
  /** Path inside `{{ }}`, e.g. `revisar.json.riesgo`. */
  path: string
  group: ZotzFlowTemplateGroup
  /** Node name for node options, to group them in the picker. */
  source?: string
}

const TRIGGER_PATHS: Record<ZotzFlowTrigger['kind'], string[]> = {
  manual: [],
  chat_command: ['text'],
  schedule: ['scheduledFor'],
  agent_finished: [
    'agent.agentId',
    'agent.title',
    'workspace.name',
    'workspace.path',
    'workspace.branch',
    'lastMessage',
    'outcome'
  ],
  pull_request: [
    'action',
    'pr.number',
    'pr.title',
    'pr.body',
    'pr.repo',
    'pr.branch',
    'pr.baseBranch',
    'pr.author',
    'pr.url',
    'pr.changedFiles'
  ],
  task_moved: ['task.id', 'task.title', 'task.body', 'task.url', 'from', 'to'],
  webhook: ['body', 'headers'],
  flow_call: []
}

function triggerOptions(triggers: readonly ZotzFlowTrigger[]): ZotzFlowTemplateOption[] {
  const paths = new Set<string>(['kind'])
  for (const trigger of triggers) {
    for (const path of TRIGGER_PATHS[trigger.kind]) {
      paths.add(path)
    }
    if ('inputs' in trigger) {
      for (const field of trigger.inputs) {
        paths.add(`inputs.${field.name}`)
      }
    }
  }
  return [...paths].map((path) => ({ path: `trigger.${path}`, group: 'trigger' }))
}

function chatOptions(triggers: readonly ZotzFlowTrigger[]): ZotzFlowTemplateOption[] {
  const chat = triggers.filter((trigger) => trigger.kind === 'chat_command')
  if (chat.length === 0) {
    return []
  }
  return Object.entries(ZOTZ_FLOW_CHAT_TEMPLATE_KEYS)
    .filter(([, flag]) => flag === null || chat.some((trigger) => trigger.context[flag]))
    .map(([key]) => ({ path: `chat.${key}`, group: 'chat' }))
}

function jsonFields(output: ZotzFlowOutputFormat): string[] {
  if (output.mode !== 'json') {
    return []
  }
  if ('fields' in output) {
    return output.fields.map((field) => field.name)
  }
  const properties = output.schema.properties
  return properties && typeof properties === 'object' ? Object.keys(properties) : []
}

function nodeOptions(node: ZotzFlowNode): ZotzFlowTemplateOption[] {
  const props: string[] = []
  if ('output' in node) {
    props.push('output')
    const fields = jsonFields(node.output)
    props.push(...(fields.length > 0 ? fields.map((field) => `json.${field}`) : []))
    if (node.output.mode === 'json' && fields.length === 0) {
      props.push('json')
    }
  } else if (node.kind === 'for_each') {
    props.push('output', 'json')
  } else if (node.kind === 'subflow') {
    props.push('output')
  }
  if (node.kind === 'command') {
    props.push('exitCode')
  }
  props.push('status')
  return props.map((prop) => ({ path: `${node.name}.${prop}`, group: 'node', source: node.name }))
}

/** What a field of `nodeId` may reference, in picker order: trigger, chat, loop item, earlier steps. */
export function listZotzFlowTemplateOptions(
  draft: Pick<ZotzFlowDraft, 'triggers' | 'nodes' | 'edges'>,
  nodeId: string
): ZotzFlowTemplateOption[] {
  const scope = createZotzFlowTemplateScope(draft)
  const before = scope.before(nodeId)
  const inLoop = scope.loops(nodeId).length > 0
  return [
    ...triggerOptions(draft.triggers),
    ...chatOptions(draft.triggers),
    ...(inLoop
      ? (['item', 'item.index', 'item.total'] as const).map((path) => ({
          path,
          group: 'item' as const
        }))
      : []),
    ...draft.nodes.filter((node) => before.has(node.id)).flatMap(nodeOptions)
  ]
}
