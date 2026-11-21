import type { AppState } from '@/store/types'
import { findWorktreeById } from '@/store/github/refresh/worktree-refresh'
import { selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'
import { getRepoExecutionHostId } from '../../../../../shared/execution-host'
import type { ZotzLinkMember } from './zotz-link-groups'

/** The open conversation as a link member (its machine and worktree path); null for folders. */
export function selectActiveZotzLinkMember(state: AppState): ZotzLinkMember | null {
  const id = state.activeWorktreeId
  const worktree = id ? findWorktreeById(state, id) : null
  const repo = worktree ? state.repos.find((r) => r.id === worktree.repoId) : undefined
  return worktree && repo ? { hostId: getRepoExecutionHostId(repo), path: worktree.path } : null
}

/** This window's id for a member's worktree, to open it; null when this window doesn't list it. */
export function findZotzLinkWorktreeId(state: AppState, member: ZotzLinkMember): string | null {
  const worktreesByRepo = selectWorktreesByRepo(state)
  for (const repo of state.repos) {
    if (getRepoExecutionHostId(repo) !== member.hostId) {
      continue
    }
    const match = (worktreesByRepo[repo.id] ?? []).find((w) => w.path === member.path)
    if (match) {
      return match.id
    }
  }
  return null
}
