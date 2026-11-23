import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { LOCAL_EXECUTION_HOST_ID } from '../../../shared/execution-host'
import type { TuiAgent } from '../../../shared/agent-launch/catalog/tui-agent'
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
