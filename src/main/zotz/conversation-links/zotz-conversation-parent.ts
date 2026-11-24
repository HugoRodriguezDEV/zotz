import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { LOCAL_EXECUTION_HOST_ID } from '../../../shared/execution-host'
import type { TuiAgent } from '../../../shared/agent-launch/catalog/tui-agent'
import type { Worktree } from '../../../shared/worktree/types'
import { splitWorktreeId } from '../../../shared/worktree/id'
import { worktreeRowTarget } from '../../persistence/host-qualified-worktree-meta'
import {
  buildCliWorkspaceProvenance,
  type CliWorkspaceProvenanceRequest
} from '../../../shared/cli-workspace-provenance'

/**
 * The worktree of the agent that asked for a create, from its own session id. Independent of Orca
 * lineage: `--no-parent` still means "not a stacked branch", and the creator is still recorded.
 */
export async function resolveZotzCreatorWorktreeId(
  runtime: OrcaRuntimeService,
  callerAgentSessionId: string | undefined
): Promise<string | undefined> {
  if (!callerAgentSessionId) {
    return undefined
  }
  try {
    const store = await runtime.openAgentSessionRecordStore()
    const location = store.getConversation(callerAgentSessionId)?.location
    return location?.executionHostId === LOCAL_EXECUTION_HOST_ID &&
      location.workspaceKind === 'git-worktree'
      ? location.workspaceId
      : undefined
  } catch {
    // A creator we cannot read never blocks the create.
    return undefined
  }
}

/** Upstream's CLI provenance (stamped now) plus the creating conversation, for both create paths. */
export async function buildZotzCliWorkspaceProvenance(
  runtime: OrcaRuntimeService,
  params: {
    cliProvenanceRequest?: CliWorkspaceProvenanceRequest
    startupAgent?: TuiAgent
    createdWithAgent?: TuiAgent
  }
): Promise<ReturnType<typeof buildCliWorkspaceProvenance>> {
  const request = params.cliProvenanceRequest
  return buildCliWorkspaceProvenance(request, {
    startupAgent: params.startupAgent ?? params.createdWithAgent,
    createdAt: Date.now(),
    zotzParentWorktreeId: await resolveZotzCreatorWorktreeId(runtime, request?.callerAgentSessionId)
  })
}

/**
 * `orchestration worker-start` creates through Orca's managed path with no CLI provenance, so its creator is stamped right
 * after. Stamping after (not at) create keeps Orca's naming: a created-by-cli create pins a generated name.
 */
export function recordZotzWorkerCreator(
  runtime: Pick<
    OrcaRuntimeService,
    'requireStore' | 'invalidateResolvedWorktreeCache' | 'notifyWorktreesChanged'
  >,
  worktree: Pick<Worktree, 'id' | 'repoId' | 'hostId' | 'identity'>,
  creator: { worktreeId: string; agent: TuiAgent; callerTerminalHandle?: string }
): void {
  if (!splitWorktreeId(creator.worktreeId) || creator.worktreeId === worktree.id) {
    return
  }
  try {
    const store = runtime.requireStore()
    const target = worktreeRowTarget(store, {
      id: worktree.id,
      hostId: worktree.identity?.executionHostId ?? worktree.hostId
    })
    if (!target) {
      return
    }
    const meta = store.getWorktreeMetaForHost?.(target.id, target.hostId)
    if (meta?.cliProvenance) {
      return
    }
    store.setWorktreeMeta(target, {
      cliProvenance: {
        kind: 'created-by-cli',
        createdAt: Date.now(),
        ...(creator.callerTerminalHandle
          ? { callerTerminalHandle: creator.callerTerminalHandle }
          : {}),
        startupAgent: creator.agent,
        zotzParentWorktreeId: creator.worktreeId
      },
      // An unset flag on a created-by-cli row reads as a pinned legacy CLI label.
      displayNameIsPinned: meta?.displayNameIsPinned ?? false
    })
    runtime.invalidateResolvedWorktreeCache()
    runtime.notifyWorktreesChanged(worktree.repoId)
  } catch {
    // Nesting is cosmetic; it never fails a worker start.
  }
}
