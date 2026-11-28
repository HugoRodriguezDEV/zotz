import { ZotzFlowSchema } from '../../../../../shared/zotz/flows/zotz-flow-contract'
import type {
  ZotzFlowNodeRun,
  ZotzFlowRun
} from '../../../../../shared/zotz/flows/zotz-flow-run-contract'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import { ZotzFlowChatRunCard } from './ZotzFlowChatRunCard'

const AT = { x: 0, y: 0 }

const flow = ZotzFlowSchema.parse({
  id: 'flow-review',
  name: 'Revisar PR',
  slug: 'revisar-pr',
  hostId: 'local',
  triggers: [{ id: 'chat', kind: 'chat_command', command: 'revisar-pr' }],
  nodes: [
    {
      id: 'review',
      name: 'revisar',
      kind: 'agent',
      agentId: 'claude',
      prompt: 'Revisa {{trigger.text}}',
      workspaceSource: 'chat',
      runContext: null,
      runInChatSession: true,
      output: { mode: 'json', fields: [{ name: 'riesgo', type: 'string' }] },
      position: AT
    },
    { id: 'gate', name: 'aprobar', kind: 'approval', message: 'Riesgo alto', position: AT },
    {
      id: 'each',
      name: 'cada_archivo',
      kind: 'for_each',
      items: '{{review.json.files}}',
      position: AT
    },
    {
      id: 'note',
      name: 'nota',
      kind: 'chat_reply',
      mode: 'note',
      content: '{{review.output}}',
      position: AT
    }
  ],
  edges: [],
  createdAt: 1,
  updatedAt: 1
})

function nodeRun(nodeId: string, patch: Partial<ZotzFlowNodeRun>): ZotzFlowNodeRun {
  return {
    nodeId,
    iteration: [],
    status: 'done',
    inputs: {},
    output: null,
    port: 'main',
    attempts: [],
    error: null,
    queuedAt: null,
    startedAt: 1,
    finishedAt: 2,
    ...patch
  }
}

function run(patch: Partial<ZotzFlowRun>): ZotzFlowRun {
  return {
    id: 'run-12',
    flowId: flow.id,
    flowUpdatedAt: 1,
    runNumber: 12,
    hostId: 'local',
    status: 'running',
    trigger: { triggerId: 'chat', kind: 'chat_command', inputs: {}, text: 'seguridad' },
    chat: { text: 'seguridad', sessionId: 'chat-1' },
    nodes: [],
    error: null,
    createdAt: 1,
    queuedAt: 1,
    startedAt: 1,
    finishedAt: null,
    ...patch
  }
}

const frame = (node: React.ReactNode) => (
  <div className="native-chat-appearance bg-chat-pane py-3">{node}</div>
)

export const running = defineFixture({
  width: 720,
  render: () =>
    frame(
      <ZotzFlowChatRunCard
        flow={flow}
        run={run({
          status: 'waiting_approval',
          nodes: [
            nodeRun('review', {}),
            nodeRun('gate', { status: 'waiting_approval', port: null, finishedAt: null })
          ]
        })}
        machineLabel="MSI"
        onOpenRun={() => {}}
        onCancel={() => {}}
      />
    )
})

export const finishedWithNote = defineFixture({
  width: 720,
  render: () =>
    frame(
      <ZotzFlowChatRunCard
        flow={flow}
        run={run({
          status: 'done',
          finishedAt: 9,
          nodes: [
            nodeRun('review', {}),
            nodeRun('gate', { port: 'approved' }),
            nodeRun('each', {
              port: 'with_failures',
              loop: {
                total: 4,
                iterations: [0, 1, 2, 3].map((index) => ({
                  index,
                  status: index === 2 ? 'failed' : 'done',
                  output: null,
                  error: null
                }))
              }
            }),
            nodeRun('note', {
              output: {
                markdown:
                  '**Riesgo: bajo.** El PR solo cambia textos.\n\n- Sin cambios de permisos\n- Pruebas al día',
                json: null,
                truncated: false,
                capturedAt: 9
              }
            })
          ]
        })}
      />
    )
})

export const failed = defineFixture({
  width: 720,
  render: () =>
    frame(
      <ZotzFlowChatRunCard
        flow={flow}
        run={run({
          status: 'failed',
          finishedAt: 9,
          error: 'revisar: The chat that fired this flow is not on the machine that runs it.',
          nodes: [
            nodeRun('review', {
              status: 'failed',
              port: null,
              error:
                'The chat that fired this flow is not on the machine that runs it. Move the flow to that machine to reply there.'
            })
          ]
        })}
        onOpenRun={() => {}}
      />
    )
})
