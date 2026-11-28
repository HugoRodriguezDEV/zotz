import type { Repo } from '../../../shared/repository/repo-types'
import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from '../../../shared/execution-host'
import { getOwnerRepoForRemote } from '../../github/repositories/github-repository-identity'
import type { RuntimeStore } from '../../runtime/construction/runtime-store-contract'
import { refreshZotzTaskFeeds } from '../tasks/zotz-task-connector-registry'
import { onZotzTaskDocumentChanged } from '../tasks/zotz-task-document-changes'
import { isZotzRelayLive, subscribeZotzRelayNotices } from '../tasks/zotz-task-relay-notices'
import {
  watchZotzFlowAgentFinished,
  type ZotzFlowAgentFinishedDeps
} from './zotz-flow-agent-finished-source'
import {
  createZotzFlowEventDispatcher,
  type ZotzFlowEventDispatcher,
  type ZotzFlowEventKind
} from './zotz-flow-event-dispatch'
import { ZotzFlowEventMemory } from './zotz-flow-event-memory'
import { findZotzFlowOriginMark } from './zotz-flow-origin'
import { watchZotzFlowPullRequests } from './zotz-flow-pull-request-source'
import type { ZotzFlowService } from './zotz-flow-service'
import type { ZotzFlowStore } from './zotz-flow-store'
import { watchZotzFlowTaskMoves } from './zotz-flow-task-moved-source'
import { registerZotzFlowWebhooks } from './zotz-flow-webhook'

// Webhooks need no listener: each request reads the stored flows.
const SOURCE_KINDS = ['agent_finished', 'pull_request', 'task_moved'] as const
type SourceKind = (typeof SOURCE_KINDS)[number] & ZotzFlowEventKind

/** owner/name of this machine's GitHub repos (SSH repos are read where they live). */
async function localGitHubRepos(store: Pick<RuntimeStore, 'getRepos'>): Promise<string[]> {
  const local = store
    .getRepos()
    .filter(
      (repo: Repo) =>
        getRepoExecutionHostId(repo) === LOCAL_EXECUTION_HOST_ID && repo.kind !== 'folder'
    )
  const resolved = await Promise.all(
    local.map((repo) => getOwnerRepoForRemote(repo.path, 'origin').catch(() => null))
  )
  return resolved.flatMap((ownerRepo) =>
    ownerRepo ? [`${ownerRepo.owner}/${ownerRepo.repo}`] : []
  )
}

/**
 * Event triggers (spec §4.2, §7) of the flows stored on this machine. Each source runs only
 * while some enabled flow listens to it, and follows saves, turn-offs and deletes.
 */
export async function startZotzFlowEventTriggers(input: {
  flowStore: ZotzFlowStore
  service: ZotzFlowService
  store: Pick<RuntimeStore, 'getRepos' | 'getRepo' | 'getWorktreeMeta' | 'getFolderWorkspaces'>
  userDataPath: string
  agents: Pick<ZotzFlowAgentFinishedDeps, 'transitions' | 'getAcceptedReply'>
}): Promise<() => void> {
  const { flowStore, service } = input
  const memory = new ZotzFlowEventMemory(input.userDataPath)
  await memory.load()
  const dispatcher: ZotzFlowEventDispatcher = createZotzFlowEventDispatcher({
    listFlows: () => flowStore.listFlows(),
    start: (flowId, trigger, origin) => service.startRun(flowId, trigger, origin)
  })
  const sources: Record<SourceKind, () => () => void> = {
    agent_finished: () =>
      watchZotzFlowAgentFinished({
        dispatcher,
        store: input.store,
        findOrigin: (target) =>
          findZotzFlowOriginMark((id) => flowStore.getFlow(id), flowStore.listAllRuns(), target),
        ...input.agents
      }),
    pull_request: () =>
      watchZotzFlowPullRequests({
        dispatcher,
        memory,
        localRepos: () => localGitHubRepos(input.store),
        relay: { live: isZotzRelayLive, subscribe: subscribeZotzRelayNotices },
        now: Date.now
      }),
    task_moved: () =>
      watchZotzFlowTaskMoves({
        dispatcher,
        onDocumentChanged: onZotzTaskDocumentChanged,
        refreshFeeds: refreshZotzTaskFeeds
      })
  }
  const running = new Map<SourceKind, () => void>()
  const sync = (): void => {
    for (const kind of SOURCE_KINDS) {
      const wanted = dispatcher.wanted(kind)
      const stop = running.get(kind)
      if (wanted && !stop) {
        running.set(kind, sources[kind]())
      } else if (!wanted && stop) {
        stop()
        running.delete(kind)
      }
    }
  }
  sync()
  const unsubscribe = flowStore.subscribe((event) => {
    if (event.type !== 'run') {
      sync()
    }
  })
  const unregisterWebhooks = registerZotzFlowWebhooks({
    findTrigger: (triggerId) => {
      for (const flow of flowStore.listFlows()) {
        for (const trigger of flow.triggers) {
          if (trigger.kind === 'webhook' && trigger.id === triggerId) {
            return { flowId: flow.id, token: trigger.token }
          }
        }
      }
      return null
    },
    start: (flowId, trigger) =>
      service.startRun(flowId, trigger, { source: 'event', causedBy: null })
  })
  return () => {
    unregisterWebhooks()
    unsubscribe()
    for (const stop of running.values()) {
      stop()
    }
    running.clear()
    void memory.flush()
  }
}
