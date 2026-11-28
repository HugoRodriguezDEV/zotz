import { mkdtemp, rm } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentPaneChange } from '../../agent-hooks/observations/agent-transition-detector'
import type { AgentStatusIpcPayload } from '../../../shared/agent-status/contracts/agent-status-ipc-payload'
import { ZotzFlowDraftSchema } from '../../../shared/zotz/flows/zotz-flow-contract'
import type { ZotzFlowRun } from '../../../shared/zotz/flows/zotz-flow-run-contract'
import type { ZotzTasksDocument } from '../../../shared/zotz/tasks/zotz-tasks-contract'
import { reportZotzTaskDocumentChange } from '../tasks/zotz-task-document-changes'
import { publishZotzRelayNotices } from '../tasks/zotz-task-relay-notices'
import { startZotzFlowEventTriggers } from './zotz-flow-event-triggers'
import { ZotzFlowService } from './zotz-flow-service'
import { ZotzFlowStore } from './zotz-flow-store'
import { withZotzFlowWebhooks } from './zotz-flow-webhook'

const graphql = vi.hoisted(() => ({ runGraphql: vi.fn() }))
vi.mock('../../github/project-view/project-graphql', () => graphql)

const TOKEN = 'a'.repeat(40)

// The GitHub reader is mocked to answer at once, so a few turns of the event loop settle a notice.
async function settle(): Promise<void> {
  for (let turn = 0; turn < 5; turn++) {
    await new Promise((resolve) => setImmediate(resolve))
  }
}

type Harness = {
  dir: string
  flowStore: ZotzFlowStore
  service: ZotzFlowService
  stop: () => void
  emit: (change: AgentPaneChange) => void
  rows: Map<string, AgentStatusIpcPayload>
}

async function start(dir: string, triggers: unknown[]): Promise<Harness> {
  const flowStore = new ZotzFlowStore(dir)
  await flowStore.load()
  if (!flowStore.getFlow('flow-a')) {
    const saved = flowStore.saveFlow(
      ZotzFlowDraftSchema.parse({
        id: 'flow-a',
        name: 'A',
        slug: 'a',
        hostId: 'local',
        triggers,
        nodes: [
          { id: 'say', name: 'say', kind: 'template', position: { x: 0, y: 0 }, content: 'ok' }
        ]
      }),
      null
    )
    expect(saved.saved).toBe(true)
  }
  const service = new ZotzFlowService(
    flowStore,
    {
      now: Date.now,
      agents: {
        admit: async () => ({ release: () => {} }),
        start: async () => {
          throw new Error('no agents in this test')
        },
        followUp: async () => {
          throw new Error('no agents in this test')
        },
        reattach: () => null,
        stop: async () => {}
      },
      runCommand: async () => {
        throw new Error('no commands in this test')
      },
      fetch: async () => {
        throw new Error('no http in this test')
      },
      notify: async () => {}
    },
    async () => {
      throw new Error('no subflows in this test')
    }
  )
  const listeners = new Set<(change: AgentPaneChange) => void>()
  const rows = new Map<string, AgentStatusIpcPayload>()
  const stopEvents = await startZotzFlowEventTriggers({
    flowStore,
    service,
    store: {
      getRepos: () => [],
      getRepo: () => undefined,
      getWorktreeMeta: () => undefined,
      getFolderWorkspaces: () => []
    },
    userDataPath: dir,
    agents: {
      transitions: {
        subscribe: (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        latestRow: (paneKey) => rows.get(paneKey) ?? null
      },
      getAcceptedReply: (paneKey) => `reply from ${paneKey}`
    }
  })
  return {
    dir,
    flowStore,
    service,
    rows,
    emit: (change) => listeners.forEach((listener) => listener(change)),
    stop: () => {
      stopEvents()
      service.stop()
    }
  }
}

function runsOf(harness: Harness): ZotzFlowRun[] {
  return harness.flowStore.listRuns('flow-a').runs
}

function finishTurn(harness: Harness, paneKey: string, at: number): void {
  harness.rows.set(paneKey, {
    paneKey,
    state: 'done',
    prompt: '',
    stateStartedAt: at,
    receivedAt: at,
    connectionId: null,
    agentType: 'claude'
  })
  harness.emit({
    kind: 'moved',
    paneKey,
    workspace: { worktreeId: 'repo-1::/work/app', sshHostId: null },
    from: 'working',
    to: 'done',
    at,
    transition: 'turn-finished'
  })
}

describe('flow event triggers', () => {
  let dir: string
  let harness: Harness | null = null

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'zotz-flow-events-'))
    graphql.runGraphql.mockReset()
  })

  afterEach(async () => {
    harness?.stop()
    harness = null
    await settle()
    await rm(dir, { recursive: true, force: true })
  })

  it('starts on a finished agent but not on an agent the same flow launched', async () => {
    harness = await start(dir, [{ id: 'when-done', kind: 'agent_finished', outcomes: ['success'] }])
    finishTurn(harness, 'pane-user', 1_000)
    await vi.waitFor(() => expect(runsOf(harness!)).toHaveLength(1))
    const first = runsOf(harness)[0]!
    expect(first.trigger).toMatchObject({
      triggerId: 'when-done',
      kind: 'agent_finished',
      agent: { agentId: 'claude' },
      workspace: { id: 'repo-1::/work/app', path: '/work/app' },
      outcome: 'success',
      lastMessage: 'reply from pane-user'
    })

    // The flow's own agent step ran in pane-flow; its finish must not start the flow again.
    harness.flowStore.putRun({
      ...first,
      id: 'run-with-agent',
      status: 'done',
      nodes: [
        {
          nodeId: 'say',
          iteration: [],
          status: 'done',
          inputs: {},
          output: null,
          port: 'main',
          attempts: [],
          agentSession: {
            agentId: 'claude',
            sessionKind: 'terminal',
            workspaceId: 'repo-1::/work/app',
            chatSessionId: null,
            terminalSessionId: null,
            terminalPaneKey: 'pane-flow',
            terminalPtyId: null
          },
          error: null,
          queuedAt: null,
          startedAt: null,
          finishedAt: null
        }
      ]
    })
    finishTurn(harness, 'pane-flow', 2_000)
    finishTurn(harness, 'pane-user', 3_000)
    await vi.waitFor(() => expect(runsOf(harness!)).toHaveLength(3))
    expect(
      runsOf(harness).filter(
        (run) => run.trigger.kind === 'agent_finished' && run.id !== 'run-with-agent'
      )
    ).toHaveLength(2)
    expect(
      runsOf(harness).some(
        (run) =>
          run.trigger.kind === 'agent_finished' && run.trigger.lastMessage.includes('pane-flow')
      )
    ).toBe(false)
  })

  it('answers a webhook with 202 and a run, and a wrong token with 401', async () => {
    harness = await start(dir, [{ id: 'hook-1', kind: 'webhook', token: TOKEN }])
    const server: Server = createServer(
      withZotzFlowWebhooks((_request, response) => response.writeHead(404).end())
    )
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    const url = `http://127.0.0.1:${port}/zotz/flows/hooks/hook-1`
    try {
      const wrong = await fetch(url, {
        method: 'POST',
        headers: { 'X-Zotz-Flow-Token': 'b'.repeat(40) },
        body: '{}'
      })
      expect(wrong.status).toBe(401)
      expect(runsOf(harness)).toHaveLength(0)

      const right = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Zotz-Flow-Token': TOKEN,
          'Content-Type': 'application/json',
          'X-Extra': 'yes'
        },
        body: JSON.stringify({ pr: 7 })
      })
      expect(right.status).toBe(202)
      const answer = await right.json()
      const [run] = runsOf(harness)
      expect(answer.runId).toBe(run!.id)
      expect(run!.trigger).toMatchObject({ kind: 'webhook', body: { pr: 7 } })
      const headers = run!.trigger.kind === 'webhook' ? run!.trigger.headers : {}
      expect(headers['x-extra']).toBe('yes')
      expect(headers['x-zotz-flow-token']).toBeUndefined()

      const tooLarge = await fetch(url, {
        method: 'POST',
        headers: { 'X-Zotz-Flow-Token': TOKEN },
        body: 'x'.repeat(1024 * 1024 + 1)
      }).catch(() => null)
      expect(tooLarge === null || tooLarge.status === 413).toBe(true)
      expect(runsOf(harness)).toHaveLength(1)
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })

  it('fires once when a task moves column in an external feed', async () => {
    harness = await start(dir, [{ id: 'moved', kind: 'task_moved', toColumn: 'Done' }])
    const feed = (status: string): ZotzTasksDocument => ({
      schema: 'zotz-tasks/v1',
      source: {
        id: 'acme',
        name: 'Acme',
        fields: [
          {
            name: 'Status',
            type: 'single-select',
            options: [
              { id: 'todo', name: 'Todo' },
              { id: 'done', name: 'Done' }
            ]
          }
        ]
      },
      tasks: [
        {
          id: 'T-1',
          type: 'issue',
          title: 'Ship it',
          state: 'open',
          assignees: [],
          labels: [],
          fieldValues: { Status: status },
          pullRequests: []
        }
      ]
    })
    reportZotzTaskDocumentChange({ connectorId: 'acme', previous: null, next: feed('done') })
    reportZotzTaskDocumentChange({
      connectorId: 'acme',
      previous: feed('done'),
      next: feed('todo')
    })
    expect(runsOf(harness)).toHaveLength(0)
    reportZotzTaskDocumentChange({
      connectorId: 'acme',
      previous: feed('todo'),
      next: feed('done')
    })
    reportZotzTaskDocumentChange({
      connectorId: 'acme',
      previous: feed('done'),
      next: feed('done')
    })
    expect(runsOf(harness)).toHaveLength(1)
    expect(runsOf(harness)[0]!.trigger).toMatchObject({
      kind: 'task_moved',
      task: { id: 'T-1', title: 'Ship it' },
      from: 'Todo',
      to: 'Done'
    })
  })

  it('fires once per PR notice from the relay, also after a restart', async () => {
    graphql.runGraphql.mockResolvedValue({
      ok: true,
      data: {
        repository: {
          pullRequest: {
            number: 12,
            title: 'Add login',
            body: 'Body',
            url: 'https://github.com/acme/app/pull/12',
            state: 'OPEN',
            baseRefName: 'main',
            headRefName: 'login',
            createdAt: '2026-11-28T10:00:00Z',
            mergedAt: null,
            author: { login: 'hugo' },
            repository: { nameWithOwner: 'acme/app' },
            labels: { nodes: [] },
            files: { nodes: [{ path: 'src/login.ts' }] }
          }
        }
      }
    })
    const triggers = [{ id: 'pr', kind: 'pull_request', actions: ['opened'], repo: 'acme/app' }]
    const notice = {
      cursor: '1',
      kind: 'pull_request' as const,
      action: 'opened',
      at: '2026-11-28T10:00:00Z',
      repo: 'acme/app',
      number: 12
    }
    harness = await start(dir, triggers)
    publishZotzRelayNotices([notice])
    await vi.waitFor(() => expect(runsOf(harness!)).toHaveLength(1))
    expect(runsOf(harness)[0]!.trigger).toMatchObject({
      kind: 'pull_request',
      action: 'opened',
      pr: { number: 12, repo: 'acme/app', branch: 'login', changedFiles: ['src/login.ts'] }
    })
    publishZotzRelayNotices([notice])

    harness.stop()
    await harness.flowStore.flush()
    harness = await start(dir, triggers)
    publishZotzRelayNotices([notice])
    await settle()
    expect(runsOf(harness)).toHaveLength(1)
  })
})
