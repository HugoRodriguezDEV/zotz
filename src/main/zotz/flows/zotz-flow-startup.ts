import { app } from 'electron'
import type { Store } from '../../persistence/loading-store/store'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { automationSystemSettled } from '../../automations/dispatch/automation-wake-settle'
import { createZotzFlowAgentDriver, type ZotzFlowPreviousSession } from './zotz-flow-agent-driver'
import { startZotzFlowEventTriggers } from './zotz-flow-event-triggers'
import { zotzFlowBranchName } from './zotz-flow-agent-finished-source'
import { createZotzFlowChatDriver } from './zotz-flow-chat-driver'
import { runZotzFlowCommand } from './zotz-flow-command-runner'
import { fetchZotzFlowHttp } from './zotz-flow-http-client'
import { notifyZotzFlow } from './zotz-flow-notifier'
import { registerZotzFlowRuntime, runZotzSubflow } from './zotz-flow-runtime'
import { startZotzFlowScheduler } from './zotz-flow-scheduler'
import { ZotzFlowService } from './zotz-flow-service'
import { ZotzFlowStore } from './zotz-flow-store'

// Enough history to find a reusable session without walking every retained run.
const REUSE_LOOKBACK_RUNS = 20

/** Flows live and run on this machine: the desktop app, or `zotz serve` on a server (spec §7). */
export async function startZotzFlows(input: {
  runtime: OrcaRuntimeService
  store: Store
  userDataPath: string
  allowRemoteHostScheduling: boolean
}): Promise<() => void> {
  const flowStore = new ZotzFlowStore(input.userDataPath)
  await flowStore.load()
  const previousSessions = (flowId: string, nodeId: string): ZotzFlowPreviousSession[] =>
    flowStore.listRuns(flowId, REUSE_LOOKBACK_RUNS).runs.flatMap((run) =>
      run.nodes.flatMap((nodeRun) =>
        nodeRun.nodeId === nodeId && nodeRun.agentSession && nodeRun.status === 'done'
          ? [
              {
                link: nodeRun.agentSession,
                turn: {
                  id: `zotz-flow:${run.id}:${nodeId}:${nodeRun.iteration.join('.')}`,
                  createdAt: nodeRun.attempts.at(-1)?.startedAt ?? run.createdAt
                }
              }
            ]
          : []
      )
    )
  const agents = createZotzFlowAgentDriver({
    runtime: input.runtime,
    store: input.store,
    allowRemoteHostScheduling: input.allowRemoteHostScheduling,
    previousSessions
  })
  const service = new ZotzFlowService(
    flowStore,
    {
      now: Date.now,
      agents,
      chat: createZotzFlowChatDriver({ runtime: input.runtime, agents }),
      runCommand: runZotzFlowCommand,
      fetch: fetchZotzFlowHttp,
      notify: ({ title, body, run }) =>
        notifyZotzFlow(input.store.getSettings().notifications, {
          title,
          body,
          runId: run.id,
          nodeKey: String(Date.now())
        })
    },
    runZotzSubflow
  )
  const unregister = registerZotzFlowRuntime({ store: flowStore, service })
  service.resumeAll()
  const stopScheduler = startZotzFlowScheduler({
    store: flowStore,
    start: (flowId, trigger, origin) => {
      const result = service.startRun(flowId, trigger, origin)
      if (!result.ok) {
        console.warn(`[zotz-flows] scheduled run not started: ${result.message}`)
      }
    },
    settled: () => automationSystemSettled(),
    now: Date.now
  })
  const stopEvents = await startZotzFlowEventTriggers({
    flowStore,
    service,
    store: input.store,
    readTaskBoardSources: () => input.store.getSettings().zotzTaskBoardSources,
    userDataPath: input.userDataPath,
    agents: {
      transitions: input.runtime.agentTransitions,
      getAcceptedReply: (paneKey, turnKey) => input.runtime.getAcceptedAgentReply(paneKey, turnKey),
      readBranch: async (worktreeId) =>
        zotzFlowBranchName((await input.runtime.showManagedWorktree(`id:${worktreeId}`)).branch)
    }
  })
  const stop = (): void => {
    stopEvents()
    stopScheduler()
    service.stop()
    void flowStore.flush()
    unregister()
  }
  app.once('will-quit', stop)
  return stop
}
