import type { AgentDotState } from '../../AgentStateDot'
import type { AgentType } from '../../../../../shared/agent-status/contracts/agent-status-types'
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
import type { ZotzLinkGroup } from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import { isZotzUserConversation } from '../../../../../shared/zotz/zotz-user-conversation'
import { folderWorkspaceKey } from '../../../../../shared/workspace/identity/workspace-scope'
import { folderWorkspaceToWorktree } from '../../../../../shared/folder-workspaces/folder-workspace-worktree'

export type ZotzConversationRow = {
  /** Activation key: a worktree id, or `folder:<id>` for a folder workspace. */
  id: string
  title: string
  branch: string | null
  /** What agents type to message it (`salmon`); null for loose folders. */
  shortName: string | null
  lastActivityAt: number
  /** Null for loose folders, which have no Git actions. */
  worktree: Worktree | null
  /** A loose folder as a worktree record, for rename, archive and delete. */
  folderWorktree?: Worktree
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

/** Group-membership key of a conversation: its machine and worktree path. */
export function zotzMemberKey(hostId: ExecutionHostId, path: string): string {
  return `${hostId}\n${path}`
}

function toConversationRow(
  worktree: Worktree,
  repo: Repo,
  shortNames: ReadonlyMap<string, string> | undefined
): ZotzConversationRow {
  const branch = branchLabel(worktree)
  return {
    id: worktree.id,
    title: worktree.displayName || branch || worktree.path,
    branch,
    shortName: shortNames?.get(worktree.id) ?? null,
    lastActivityAt: worktree.lastActivityAt,
    worktree,
    repo,
    hostId: getRepoExecutionHostId(repo)
  }
}

function visibleRepos(repos: readonly Repo[]): Repo[] {
  const seen = new Set<string>()
  return repos.filter((repo) => {
    if (isRepoHidden(repo) || seen.has(repo.id)) {
      return false
    }
    seen.add(repo.id)
    return true
  })
}

export function buildZotzProjectSections(input: {
  repos: readonly Repo[]
  worktreesByRepoId: Readonly<Record<string, readonly Worktree[] | undefined>>
  workspacesWithAgents: ReadonlySet<string>
  shortNames?: ReadonlyMap<string, string>
  /** Member keys (`zotzMemberKey`) shown in a group instead of their project. */
  grouped?: ReadonlySet<string>
}): ZotzProjectSection[] {
  const byKey = new Map<string, Repo[]>()
  for (const repo of visibleRepos(input.repos)) {
    const key = getProjectIdentityKey(repo)
    byKey.set(key, [...(byKey.get(key) ?? []), repo])
  }
  return [...byKey].map(([key, repos]) => {
    const conversations = repos
      .flatMap((repo) =>
        (input.worktreesByRepoId[repo.id] ?? [])
          .filter(
            (worktree) =>
              isZotzUserConversation(worktree, input.workspacesWithAgents) &&
              !input.grouped?.has(zotzMemberKey(getRepoExecutionHostId(repo), worktree.path))
          )
          .map((worktree) => toConversationRow(worktree, repo, input.shortNames))
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

export type ZotzGroupSection = {
  group: ZotzLinkGroup
  /** In the group's own order; members this window doesn't list (archived, offline server) are left out. */
  conversations: ZotzConversationRow[]
}

/** Each group with its conversations, from any project or machine. */
export function buildZotzGroupSections(input: {
  groups: readonly ZotzLinkGroup[]
  repos: readonly Repo[]
  worktreesByRepoId: Readonly<Record<string, readonly Worktree[] | undefined>>
  shortNames?: ReadonlyMap<string, string>
}): ZotzGroupSection[] {
  const rows = new Map<string, ZotzConversationRow>()
  for (const repo of visibleRepos(input.repos)) {
    for (const worktree of input.worktreesByRepoId[repo.id] ?? []) {
      if (!worktree.isArchived && !worktree.removing) {
        rows.set(
          zotzMemberKey(getRepoExecutionHostId(repo), worktree.path),
          toConversationRow(worktree, repo, input.shortNames)
        )
      }
    }
  }
  return input.groups.map((group) => ({
    group,
    conversations: group.members.flatMap((member) => {
      const row = rows.get(zotzMemberKey(member.hostId, member.path))
      return row ? [row] : []
    })
  }))
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
      folderWorktree: folderWorkspaceToWorktree(folder),
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

export type ZotzConversationStatus = {
  state: AgentDotState
  unread: boolean
  /** The agent behind the most urgent thread, for its brand mark. */
  agentType?: AgentType
}

/** One marker per conversation from all its agent threads: the most urgent state, unread if any finished unseen. */
export function summarizeZotzConversationStatus(
  threads: readonly { state: AgentDotState; unread: boolean; agentType?: AgentType }[]
): ZotzConversationStatus | null {
  let best: AgentDotState | null = null
  let agentType: AgentType | undefined
  let unread = false
  for (const thread of threads) {
    if (best === null || STATUS_URGENCY.indexOf(thread.state) < STATUS_URGENCY.indexOf(best)) {
      best = thread.state
      agentType = thread.agentType
    }
    unread ||= thread.unread
  }
  return best === null ? null : { state: best, unread, agentType }
}

/** The conversation whose agent created this one, on the same machine; null when none is recorded. */
export function zotzParentKey(row: ZotzConversationRow): string | null {
  const parentId = row.worktree?.cliProvenance?.zotzParentWorktreeId
  return parentId && parentId !== row.id ? `${row.hostId}\n${parentId}` : null
}

/** A row's identity across machines: worktree ids repeat on host twins. */
export function zotzRowKey(row: ZotzConversationRow): string {
  return `${row.hostId}\n${row.id}`
}

/**
 * Pulls children out of their lists to hang under their parent. A grouped child nests only under a
 * parent in the same group; an ungrouped one nests under its ungrouped parent even across projects.
 */
export function nestZotzChildren(
  groupLists: readonly (readonly ZotzConversationRow[])[],
  projectLists: readonly (readonly ZotzConversationRow[])[]
): {
  groupLists: ZotzConversationRow[][]
  projectLists: ZotzConversationRow[][]
  childrenOf: Map<string, ZotzConversationRow[]>
} {
  const childrenOf = new Map<string, ZotzConversationRow[]>()
  const place = new Map<string, string>()
  groupLists.forEach((list, index) =>
    list.forEach((row) => place.set(zotzRowKey(row), `g${index}`))
  )
  projectLists.forEach((list) => list.forEach((row) => place.set(zotzRowKey(row), 'projects')))
  const nests = (row: ZotzConversationRow): boolean => {
    const parent = zotzParentKey(row)
    if (!parent || place.get(parent) !== place.get(zotzRowKey(row))) {
      return false
    }
    // A cycle (never written, but stored data can be anything) keeps both rows at the top.
    const seen = new Set([zotzRowKey(row)])
    let current: string | null = parent
    while (current) {
      if (seen.has(current)) {
        return false
      }
      seen.add(current)
      const next = [...groupLists.flat(), ...projectLists.flat()].find(
        (r) => zotzRowKey(r) === current
      )
      current = next ? zotzParentKey(next) : null
    }
    return true
  }
  const keep = (list: readonly ZotzConversationRow[]): ZotzConversationRow[] =>
    list.filter((row) => {
      const parent = zotzParentKey(row)
      if (!parent || !nests(row)) {
        return true
      }
      childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), row])
      return false
    })
  return {
    groupLists: groupLists.map(keep),
    projectLists: projectLists.map(keep),
    childrenOf
  }
}
