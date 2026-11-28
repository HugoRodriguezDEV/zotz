import { describe, expect, it } from 'vitest'
import { ZotzFlowSchema, type ZotzFlow } from '../../../shared/zotz/flows/zotz-flow-contract'
import type { ZotzFlowRun } from '../../../shared/zotz/flows/zotz-flow-run-contract'
import type { ZotzFlowAgentDriver, ZotzFlowExecutorDeps } from './zotz-flow-executor-types'
import { ZotzFlowRunExecutor } from './zotz-flow-run-executor'
import { zotzFlowRetryKeptNodes } from './zotz-flow-retry'

const AT = { x: 0, y: 0 }

function flowOf(nodes: unknown[], edges: [string, string, string?][]): ZotzFlow {
  return ZotzFlowSchema.parse({
    id: 'flow-1',
    name: 'Test',
    slug: 'test',
    hostId: 'local',
    nodes,
    edges: edges.map(([from, to, port = 'main']) => ({
      id: `${from}-${to}`,
      from: { nodeId: from, port },
      to: { nodeId: to }
    })),
    createdAt: 1,
    updatedAt: 1
  })
}

function newRun(): ZotzFlowRun {
  return {
    id: 'run-1',
    flowId: 'flow-1',
    flowUpdatedAt: 1,
    runNumber: 1,
    hostId: 'local',
    status: 'queued',
    trigger: { triggerId: null, kind: 'manual', inputs: { title: 'PR $(rm -rf ~)' } },
    chat: null,
    nodes: [],
    error: null,
    createdAt: 1,
    queuedAt: 1,
    startedAt: null,
    finishedAt: null
  }
}

/** Replies per item named in the prompt; the follow-up reaches the same session. */
function scriptedAgents(replies: Record<string, string[]>): ZotzFlowAgentDriver {
  const turn = (key: string) => ({
    link: {
      agentId: 'claude' as const,
      sessionKind: 'chat' as const,
      workspaceId: 'repo::/tmp/w',
      chatSessionId: key,
      terminalSessionId: null,
      terminalPaneKey: null,
      terminalPtyId: null
    },
    reply: Promise.resolve({ text: replies[key]?.shift() ?? '', truncated: false })
  })
  return {
    admit: async () => ({ release: () => {} }),
    start: async ({ prompt }) =>
      turn(Object.keys(replies).find((key) => prompt.includes(`item ${key}`)) ?? ''),
    followUp: async ({ link }) => turn(link.chatSessionId ?? ''),
    reattach: () => null,
    stop: async () => {}
  }
}

// Fixed timestamps: step results never depend on the wall clock.
let clock = 1_000

function deps(overrides: Partial<ZotzFlowExecutorDeps> = {}): ZotzFlowExecutorDeps {
  return {
    now: () => (clock += 1),
    save: () => {},
    agents: scriptedAgents({}),
    runCommand: async () => ({
      exitCode: 0,
      stdout: '',
      stderr: '',
      truncated: false,
      error: null
    }),
    fetch: async () => ({ status: 200, body: '', truncated: false }),
    notify: async () => {},
    runSubflow: async () => {
      throw new Error('no subflows here')
    },
    ...overrides
  }
}

function template(name: string, content: string, extra: Record<string, unknown> = {}) {
  return { id: name, name, kind: 'template', content, position: AT, ...extra }
}

function statusOf(run: ZotzFlowRun, nodeId: string, iteration: number[] = []) {
  return run.nodes.find(
    (node) => node.nodeId === nodeId && node.iteration.join('.') === iteration.join('.')
  )
}

describe('ZotzFlowRunExecutor', () => {
  it('follows the condition port, skips the other branch and passes values to commands as env', async () => {
    const seenEnv: Record<string, string>[] = []
    const flow = flowOf(
      [
        {
          id: 'build',
          name: 'build',
          kind: 'command',
          command: 'echo "$ZOTZ_FLOW_TITLE"',
          env: [{ name: 'title', value: '{{trigger.inputs.title}}' }],
          position: AT
        },
        {
          id: 'ok',
          name: 'ok',
          kind: 'condition',
          value: '{{build.exitCode}}',
          operator: 'exit_code_zero',
          position: AT
        },
        template('yes', 'built: {{build.output}}'),
        template('no', 'broken'),
        template('after', '{{yes.output}}{{no.output}}')
      ],
      [
        ['build', 'ok'],
        ['ok', 'yes', 'true'],
        ['ok', 'no', 'false'],
        ['yes', 'after'],
        ['no', 'after']
      ]
    )
    const run = await new ZotzFlowRunExecutor(
      flow,
      newRun(),
      deps({
        runCommand: async ({ env }) => {
          seenEnv.push(env)
          return { exitCode: 0, stdout: 'v1.2', stderr: '', truncated: false, error: null }
        }
      }),
      { resuming: false }
    ).execute()
    expect(seenEnv).toEqual([{ ZOTZ_FLOW_TITLE: 'PR $(rm -rf ~)' }])
    expect(run.status).toBe('done')
    expect(statusOf(run, 'ok')?.port).toBe('true')
    expect(statusOf(run, 'no')?.status).toBe('skipped')
    expect(statusOf(run, 'after')?.output?.markdown).toBe('built: v1.2')
  })

  it('runs a for_each body per item, asks one JSON correction and leaves with failures', async () => {
    const flow = flowOf(
      [
        template('list', '{"items": ["a", "b", "c"]}', {
          output: { mode: 'json', fields: [{ name: 'items', type: 'array' }] }
        }),
        { id: 'each', name: 'each', kind: 'for_each', items: '{{list.json.items}}', position: AT },
        {
          id: 'review',
          name: 'review',
          kind: 'agent',
          parentId: 'each',
          agentId: 'claude',
          prompt: 'Review item {{item}} ({{item.index}}/{{item.total}})',
          workspaceSource: 'existing',
          workspaceId: 'repo::/tmp/w',
          runContext: null,
          output: { mode: 'json', fields: [{ name: 'risk', type: 'string' }] },
          position: AT
        },
        template('summary', '{{each.output}}')
      ],
      [
        ['list', 'each'],
        ['each', 'summary', 'with_failures']
      ]
    )
    const agents = scriptedAgents({
      a: ['done\n```json\n{"risk": "low"}\n```'],
      b: ['no block here', '```json\n{"risk": "high"}\n```'],
      c: ['```json\n{"risk": 3}\n```', 'still wrong']
    })
    const run = await new ZotzFlowRunExecutor(flow, newRun(), deps({ agents }), {
      resuming: false
    }).execute()
    const loop = statusOf(run, 'each')
    expect(loop?.port).toBe('with_failures')
    expect(loop?.loop?.iterations.map((it) => it.status)).toEqual(['done', 'done', 'failed'])
    expect(loop?.output?.json).toEqual([{ risk: 'low' }, { risk: 'high' }, null])
    expect(statusOf(run, 'review', [1])?.jsonCorrectionRequested).toBe(true)
    expect(statusOf(run, 'review', [2])?.status).toBe('failed')
    expect(statusOf(run, 'review', [2])?.output?.markdown).toBe('still wrong')
    expect(statusOf(run, 'summary')?.status).toBe('done')
    expect(run.status).toBe('done')
  })

  it('fails a loop over its item cap before running any iteration', async () => {
    const flow = flowOf(
      [
        { id: 'each', name: 'each', kind: 'for_each', items: 'a\nb\nc', maxItems: 2, position: AT },
        template('inner', '{{item}}', { parentId: 'each' })
      ],
      []
    )
    const run = await new ZotzFlowRunExecutor(flow, newRun(), deps(), { resuming: false }).execute()
    expect(run.status).toBe('failed')
    expect(statusOf(run, 'each')?.errorCode).toBe('loop_too_many_items')
    expect(run.nodes.some((node) => node.nodeId === 'inner')).toBe(false)
  })
})

describe('zotzFlowRetryKeptNodes', () => {
  it('keeps the steps before the failed one and drops it and everything after', async () => {
    const flow = flowOf(
      [
        template('first', 'x'),
        { id: 'fails', name: 'fails', kind: 'command', command: 'false', position: AT },
        template('last', 'y')
      ],
      [
        ['first', 'fails'],
        ['fails', 'last']
      ]
    )
    const failedRun = await new ZotzFlowRunExecutor(
      flow,
      newRun(),
      deps({
        runCommand: async () => ({
          exitCode: null,
          stdout: '',
          stderr: '',
          truncated: false,
          error: 'boom'
        })
      }),
      { resuming: false }
    ).execute()
    expect(zotzFlowRetryKeptNodes(flow, failedRun, 'fails').map((node) => node.nodeId)).toEqual([
      'first'
    ])
  })
})
