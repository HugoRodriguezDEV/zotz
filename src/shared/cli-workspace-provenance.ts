import type { TuiAgent } from './agent-launch/catalog/tui-agent'
import type { CliWorkspaceProvenance } from './worktree/types'

/** CLI create context is descriptive; host-stamped createdAt prevents skewed client clocks changing sort order. */
export type CliWorkspaceProvenanceRequest = {
  callerTerminalHandle?: string
  /** Zotz: the calling agent's own session, so the host can record which conversation created this one. */
  callerAgentSessionId?: string
  /** Zotz: the sidebar group the new conversation joins (`--group`). */
  zotzGroup?: string
}

export function buildCliWorkspaceProvenance(
  request: CliWorkspaceProvenanceRequest | undefined,
  options: { startupAgent?: TuiAgent; createdAt: number; zotzParentWorktreeId?: string }
): CliWorkspaceProvenance | undefined {
  if (!request) {
    return undefined
  }
  return {
    kind: 'created-by-cli',
    createdAt: options.createdAt,
    ...(request.callerTerminalHandle ? { callerTerminalHandle: request.callerTerminalHandle } : {}),
    ...(options.startupAgent ? { startupAgent: options.startupAgent } : {}),
    ...(options.zotzParentWorktreeId ? { zotzParentWorktreeId: options.zotzParentWorktreeId } : {}),
    ...(request.zotzGroup ? { zotzGroup: request.zotzGroup } : {})
  }
}
