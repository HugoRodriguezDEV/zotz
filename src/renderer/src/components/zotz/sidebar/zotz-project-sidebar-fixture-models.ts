import type { PublicKnownRuntimeEnvironment } from '../../../../../shared/remote-runtime/host-catalog/runtime-environments'
import type { Repo } from '../../../../../shared/repository/repo-types'
import type { Worktree } from '../../../../../shared/worktree/types'
import { EMPTY_ZOTZ_AGENT_QUEUE_SNAPSHOT } from '../../../../../shared/zotz/agent-queue/zotz-agent-queue-snapshot'

// Shared by the project sidebar fixtures; fixture files can't import each other.
export function repo(id: string, displayName: string): Repo {
  return { id, path: `/code/${id}`, displayName, badgeColor: '', addedAt: 1 }
}

export function worktree(
  repoId: string,
  branch: string,
  displayName: string,
  extra: Partial<Worktree> = {}
): Worktree {
  return {
    id: `${repoId}::${branch}`,
    displayName,
    repoId,
    path: `/code/${repoId}/${branch}`,
    branch: `refs/heads/${branch}`,
    head: 'abc1234',
    isBare: false,
    isMainWorktree: false,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 1,
    ...extra
  }
}

/** The agent queue the sidebar subscribes to, answering with nothing queued. */
export function stubEmptyZotzAgentQueue(): void {
  Object.assign(window.api, {
    zotzAgentQueue: {
      onChanged: () => () => {},
      snapshot: async () => EMPTY_ZOTZ_AGENT_QUEUE_SNAPSHOT
    }
  })
}

export const msiRuntime: PublicKnownRuntimeEnvironment = {
  id: 'msi',
  name: 'MSI',
  source: 'manual',
  createdAt: 1,
  updatedAt: 1,
  lastUsedAt: null,
  runtimeId: null,
  preferredEndpointId: 'default',
  endpoints: []
}
export const rodri: Repo = { ...repo('rodri', 'rodri'), executionHostId: 'runtime:msi' }
