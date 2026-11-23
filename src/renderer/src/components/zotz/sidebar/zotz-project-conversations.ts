import type { AgentDotState } from '../../AgentStateDot'
import type { FolderWorkspace } from '../../../../../shared/folder-workspaces/folder-workspace-types'
import { isRepoHidden } from '../../../../../shared/hidden-projects'
import type { Repo } from '../../../../../shared/repository/repo-types'
import {
  LOCAL_EXECUTION_HOST_ID,
  getRepoExecutionHostId,
  type ExecutionHostId
} from '../../../../../shared/execution-host'
import { getProjectIdentityKey } from '../../../../../shared/project/host-setup/project-host-setup-projection'
import { resolveZotzShortNames } from '../../../../../shared/zotz/zotz-short-name'
import type { Worktree } from '../../../../../shared/worktree/types'
import { isZotzUserConversation } from '../../../../../shared/zotz/zotz-user-conversation'
import { folderWorkspaceKey } from '../../../../../shared/workspace/identity/workspace-scope'

export type ZotzConversationRow = {
  /** Activation key: a worktree id, or `folder:<id>` for a folder workspace. */
  id: string
  title: string
  branch: string | null
  /** What agents type to message it (`salmon`); null for loose folders. */
  shortName: string | null
  lastActivityAt: number
  /** Null for loose folders, which have no worktree actions. */
  worktree: Worktree | null
  /** The repo copy it lives in; null for loose folders. */
  repo: Repo | null
  /** The machine it runs on. */
  hostId: ExecutionHostId
}

/** One project across machines: the same Git remote on this Mac and each server is one section. */
export type ZotzProjectSection = {
  key: string
  /** Header and actions: this machine's copy when there is one, else the first listed. */
  repo: Repo
  repos: Repo[]
  /** More than one machine holds it, so each conversation names its own. */
  multiHost: boolean
  conversations: ZotzConversationRow[]
}

type TabsByWorkspace = Readonly<Record<string, readonly unknown[] | undefined>>

function branchLabel(worktree: Pick<Worktree, 'branch' | 'head'>): string | null {
  const branch = worktree.branch.replace(/^refs\/heads\//, '')
  if (branch) {
    return branch
  }
  return worktree.head ? worktree.head.slice(0, 7) : null
}

function hasOpenTabs(tabsByWorkspace: TabsByWorkspace, key: string): boolean {
  return (tabsByWorkspace[key]?.length ?? 0) > 0
}

function byRecentActivity(a: ZotzConversationRow, b: ZotzConversationRow): number {
  return b.lastActivityAt - a.lastActivityAt
}

export function buildZotzProjectSections(input: {
  repos: readonly Repo[]
  worktreesByRepoId: Readonly<Record<string, readonly Worktree[] | undefined>>
  workspacesWithAgents: ReadonlySet<string>
  shortNames?: ReadonlyMap<string, string>
}): ZotzProjectSection[] {
  const seen = new Set<string>()
  const byKey = new Map<string, Repo[]>()
  for (const repo of input.repos) {
    if (isRepoHidden(repo) || seen.has(repo.id)) {
      continue
    }
    seen.add(repo.id)
    const key = getProjectIdentityKey(repo)
    byKey.set(key, [...(byKey.get(key) ?? []), repo])
  }
  return [...byKey].map(([key, repos]) => {
    const conversations = repos
      .flatMap((repo) =>
        (input.worktreesByRepoId[repo.id] ?? [])
          .filter((worktree) => isZotzUserConversation(worktree, input.workspacesWithAgents))
          .map((worktree) => {
            const branch = branchLabel(worktree)
            return {
              id: worktree.id,
              title: worktree.displayName || branch || worktree.path,
              branch,
              shortName: input.shortNames?.get(worktree.id) ?? null,
              lastActivityAt: worktree.lastActivityAt,
              worktree,
              repo,
              hostId: getRepoExecutionHostId(repo)
            }
          })
      )
      .sort(byRecentActivity)
    const hosts = new Set(repos.map(getRepoExecutionHostId))
    return {
      key,
      repo:
        repos.find((repo) => getRepoExecutionHostId(repo) === LOCAL_EXECUTION_HOST_ID) ?? repos[0],
      repos,
      multiHost: hosts.size > 1,
      conversations
    }
  })
}

/**
 * Short name of every workspace by id. Names are unique per machine, so each host's workspaces
 * (archived too, as its own resolver sees them) are resolved together.
 */
export function buildZotzShortNames(input: {
  repos: readonly Repo[]
  worktreesByRepoId: Readonly<Record<string, readonly Worktree[] | undefined>>
  customByHost: ReadonlyMap<ExecutionHostId, Readonly<Record<string, string>>>
}): Map<string, string> {
  const worktreesByHost = new Map<ExecutionHostId, Worktree[]>()
  for (const repo of input.repos) {
    const hostId = getRepoExecutionHostId(repo)
    const list = worktreesByHost.get(hostId) ?? []
    list.push(...(input.worktreesByRepoId[repo.id] ?? []))
    worktreesByHost.set(hostId, list)
  }
  const result = new Map<string, string>()
  for (const [hostId, worktrees] of worktreesByHost) {
    const names = resolveZotzShortNames(
      worktrees.map((worktree) => worktree.path),
      input.customByHost.get(hostId) ?? {}
    )
    for (const worktree of worktrees) {
      const name = names.get(worktree.path)
      if (name) {
        result.set(worktree.id, name)
      }
    }
  }
  return result
}

/** Loose folders (like `~`) appear only while they hold a conversation. */
export function buildZotzFolderConversations(input: {
  folders: readonly FolderWorkspace[]
  tabsByWorkspace: TabsByWorkspace
}): ZotzConversationRow[] {
  return input.folders
    .filter(
      (folder) =>
        !folder.isArchived && hasOpenTabs(input.tabsByWorkspace, folderWorkspaceKey(folder.id))
    )
    .map((folder) => ({
      id: folderWorkspaceKey(folder.id),
      title: folder.name || folder.folderPath,
      branch: null,
      shortName: null,
      lastActivityAt: 0,
      worktree: null,
      repo: null,
      hostId: folder.executionHostId ?? LOCAL_EXECUTION_HOST_ID
    }))
}

/** Most urgent first: what needs the user, then live work, then finished. */
const STATUS_URGENCY: readonly AgentDotState[] = [
  'failed',
  'blocked',
  'permission',
  'waiting',
  'interrupted',
  'unconfirmed',
  'working',
  'monitoring',
  'unverifiable',
  'done',
  'idle'
]

export type ZotzConversationStatus = { state: AgentDotState; unread: boolean }

/** One marker per conversation from all its agent threads: the most urgent state, unread if any finished unseen. */
export function summarizeZotzConversationStatus(
  threads: readonly { state: AgentDotState; unread: boolean }[]
): ZotzConversationStatus | null {
  let best: AgentDotState | null = null
  let unread = false
  for (const thread of threads) {
    if (best === null || STATUS_URGENCY.indexOf(thread.state) < STATUS_URGENCY.indexOf(best)) {
      best = thread.state
    }
    unread ||= thread.unread
  }
  return best === null ? null : { state: best, unread }
}
