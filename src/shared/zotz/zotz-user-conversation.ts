import type { Worktree } from '../worktree/types'

/**
 * Workspaces the user started, or handed off to a new agent (a CLI create with `--agent`);
 * no automation or bare CLI creations; the main checkout only while an agent works in it.
 */
export function isZotzUserConversation(
  worktree: Pick<
    Worktree,
    'id' | 'isArchived' | 'removing' | 'cliProvenance' | 'automationProvenance' | 'isMainWorktree'
  >,
  workspacesWithAgents: ReadonlySet<string>
): boolean {
  if (worktree.isArchived || worktree.removing) {
    return false
  }
  if (worktree.cliProvenance && !worktree.cliProvenance.startupAgent) {
    return false
  }
  if (worktree.automationProvenance) {
    return false
  }
  return !worktree.isMainWorktree || workspacesWithAgents.has(worktree.id)
}
