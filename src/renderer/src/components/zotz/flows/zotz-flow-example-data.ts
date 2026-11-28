import type { ZotzFlow } from '../../../../../shared/zotz/flows/zotz-flow-contract'
import type {
  ZotzFlowNode,
  ZotzFlowNodeOf
} from '../../../../../shared/zotz/flows/zotz-flow-node-contract'
import type {
  ZotzFlowNodeRun,
  ZotzFlowNodeRunStatus,
  ZotzFlowRun
} from '../../../../../shared/zotz/flows/zotz-flow-run-contract'
import { autoLayoutZotzFlow } from './zotz-flow-auto-layout'
import { createZotzFlowNode } from './zotz-flow-node-catalog'
import { createZotzFlowTrigger } from './zotz-flow-trigger-catalog'

// Fixed ids and times keep fixture screenshots stable.
const AT = Date.UTC(2026, 10, 28, 15, 0)
const at = { x: 0, y: 0 }
const CHAT_TRIGGER = createZotzFlowTrigger('chat_command', 't-chat')
const RISK_LEVELS = 'alto, medio o bajo'
const APPROVAL_TEXT = 'Se corrigieron {{cada_pr.output}}. ¿Hago merge?'

const review: ZotzFlowNodeOf<'agent'> = {
  ...createZotzFlowNode('agent', { id: 'n-review', name: 'revisar', position: at }),
  prompt: 'Revisa los PRs abiertos de {{chat.repo}} y lista los que tocan pagos.\n{{trigger.text}}',
  output: {
    mode: 'json',
    fields: [
      { name: 'riesgo', type: 'string', required: true, description: RISK_LEVELS },
      { name: 'prs', type: 'array', required: true }
    ]
  }
}

const nodes: ZotzFlowNode[] = [
  review,
  {
    ...createZotzFlowNode('condition', { id: 'n-risky', name: 'riesgo_alto', position: at }),
    value: '{{revisar.json.riesgo}}',
    operator: 'equals',
    compareTo: 'alto'
  },
  {
    ...createZotzFlowNode('for_each', { id: 'n-loop', name: 'cada_pr', position: at }),
    items: '{{revisar.json.prs}}'
  },
  {
    ...createZotzFlowNode('agent', {
      id: 'n-fix',
      name: 'corregir',
      position: at,
      parentId: 'n-loop'
    }),
    agentId: 'codex',
    prompt: 'Corrige el PR {{item}} siguiendo la revisión:\n{{revisar.output}}'
  },
  {
    ...createZotzFlowNode('approval', { id: 'n-approve', name: 'aprobar', position: at }),
    message: APPROVAL_TEXT
  }
]

export const ZOTZ_FLOW_EXAMPLE: ZotzFlow = autoLayoutZotzFlow({
  id: 'flow-review',
  name: 'Revisar PRs',
  slug: 'revisar-prs',
  description: '',
  hostId: 'local',
  enabled: true,
  triggers: [
    {
      ...CHAT_TRIGGER,
      command: 'revisar-pr',
      context: { ...CHAT_TRIGGER.context, lastAnswer: true }
    }
  ],
  nodes,
  edges: [
    { id: 'e1', from: { nodeId: 'n-review', port: 'main' }, to: { nodeId: 'n-risky' } },
    { id: 'e2', from: { nodeId: 'n-risky', port: 'true' }, to: { nodeId: 'n-loop' } },
    { id: 'e3', from: { nodeId: 'n-loop', port: 'complete' }, to: { nodeId: 'n-approve' } },
    { id: 'e4', from: { nodeId: 'n-loop', port: 'with_failures' }, to: { nodeId: 'n-approve' } }
  ],
  concurrency: { max: 1, whenBusy: 'queue' },
  maxRunsPerHour: 20,
  createdAt: AT,
  updatedAt: AT
})

function nodeRun(
  nodeId: string,
  status: ZotzFlowNodeRunStatus,
  extra: Partial<ZotzFlowNodeRun> = {}
): ZotzFlowNodeRun {
  const started = status === 'pending' ? null : AT + 10_000
  return {
    nodeId,
    iteration: [],
    status,
    inputs: {},
    output: null,
    port: null,
    attempts: started ? [{ attempt: 1, startedAt: started, finishedAt: null, error: null }] : [],
    error: null,
    queuedAt: started,
    startedAt: started,
    finishedAt: status === 'done' || status === 'failed' ? AT + 95_000 : null,
    ...extra
  }
}

const ITEMS = 10
const loopStatuses: ZotzFlowNodeRunStatus[] = [
  'done',
  'done',
  'done',
  'failed',
  'done',
  'done',
  'done',
  'done',
  'running',
  'running'
]

/** Halfway: the loop has finished 8 of 10 items and item 4 failed. */
export const ZOTZ_FLOW_EXAMPLE_RUN: ZotzFlowRun = {
  id: 'run-12',
  flowId: ZOTZ_FLOW_EXAMPLE.id,
  flowUpdatedAt: AT,
  runNumber: 12,
  hostId: 'local',
  status: 'running',
  trigger: { triggerId: 't-chat', kind: 'chat_command', inputs: {}, text: 'enfócate en pagos' },
  chat: { text: 'enfócate en pagos', repo: 'avena/pagos' },
  nodes: [
    nodeRun('n-review', 'done', {
      inputs: {
        prompt:
          'Revisa los PRs abiertos de avena/pagos y lista los que tocan pagos.\nenfócate en pagos'
      },
      output: {
        markdown: 'Encontré 10 PRs que tocan pagos; 3 cambian el cálculo de comisiones.',
        json: {
          riesgo: 'alto',
          prs: Array.from({ length: ITEMS }, (_, index) => `#${120 + index}`)
        },
        truncated: false,
        capturedAt: AT + 95_000
      },
      port: 'main'
    }),
    nodeRun('n-risky', 'done', { inputs: { value: 'alto', compareTo: 'alto' }, port: 'true' }),
    nodeRun('n-loop', 'running', {
      inputs: { items: '["#120", "#121", "…"]' },
      loop: {
        total: ITEMS,
        iterations: loopStatuses.map((status, index) => ({
          index,
          status,
          output: null,
          error: status === 'failed' ? 'El agente terminó sin cambios.' : null
        }))
      }
    }),
    ...loopStatuses.map((status, index) =>
      nodeRun('n-fix', status, {
        iteration: [index],
        inputs: { prompt: `Corrige el PR #${120 + index} siguiendo la revisión:\n…` },
        error: status === 'failed' ? 'El agente terminó sin cambios.' : null
      })
    ),
    nodeRun('n-approve', 'pending')
  ],
  error: null,
  createdAt: AT,
  queuedAt: AT,
  startedAt: AT + 1_000,
  finishedAt: null
}
