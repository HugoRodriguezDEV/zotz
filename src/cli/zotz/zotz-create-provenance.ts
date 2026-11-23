import { getOptionalStringFlag } from '../arguments/flags'
import { readInjectedAgentSessionId } from '../../shared/agent-session/lifecycle/launch/agent-session-caller-env'
import type { RuntimeClient } from '../runtime/client'

/**
 * `worktree create`'s CLI provenance: upstream's terminal handle plus, for Zotz, the calling agent's session (only meaningful to
 * this machine's own host, so never sent to a server) and the `--group` to join.
 */
export function zotzCliProvenanceRequest(
  callerTerminalHandle: string | undefined,
  flags: Map<string, string | boolean>,
  client: RuntimeClient
): { callerTerminalHandle?: string; callerAgentSessionId?: string; zotzGroup?: string } {
  const sessionId = client.isRemote ? undefined : readInjectedAgentSessionId()
  const group = getOptionalStringFlag(flags, 'group')?.trim()
  return {
    ...(callerTerminalHandle ? { callerTerminalHandle } : {}),
    ...(sessionId ? { callerAgentSessionId: sessionId } : {}),
    ...(group ? { zotzGroup: group } : {})
  }
}
