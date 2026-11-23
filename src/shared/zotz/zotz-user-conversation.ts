import type { Worktree } from '../worktree/types'

/** Workspaces the user started: no CLI/automation creations; the main checkout only while an agent works in it. */
export function isZotzUserConversation(
  worktree: Pick<
    Worktree,
    'id' | 'isArchived' | 'removing' | 'cliProvenance' | 'automationProvenance' | 'isMainWorktree'
  >,
  workspacesWithAgents: ReadonlySet<string>
): boolean {
  if (worktree.isArchived || worktree.removing || worktree.cliProvenance) {
    return false
  }
  if (worktree.automationProvenance) {
    return false
  }
  return !worktree.isMainWorktree || workspacesWithAgents.has(worktree.id)
}
