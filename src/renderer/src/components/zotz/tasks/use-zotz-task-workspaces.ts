import { createContext, useCallback, useContext, useMemo } from 'react'
import { useAppStore } from '@/store/index'
import { selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'
import { getIndexedAllWorktrees } from '@/store/slices/worktrees/listing/worktree-catalog-index'
import { useRepoSlugIndex } from '@/lib/workspace/catalog/repo-slug-index'
import { activateAndRevealWorktree } from '@/lib/workspace/activation/worktree-activation'
import type { Worktree } from '../../../../../shared/worktree/types'
import type { ZotzTaskBoardItem } from '../../../../../shared/zotz/tasks/zotz-task-board-columns'
import { useZotzAgentQueue } from '../agent-queue/zotz-agent-queue-store'
import { closeZotzBoard } from './zotz-board-modal-store'

export type ZotzTaskWorkspace = {
  worktreeId: string
  name: string
  /** State of an agent running in it, if any: working, waiting, blocked or done. */
  agentState: string | null
}

export type ZotzTaskWorkspaces = {
  find: (item: ZotzTaskBoardItem) => ZotzTaskWorkspace | null
  open: (workspace: ZotzTaskWorkspace) => void
  create: (item: ZotzTaskBoardItem) => void
}

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

/** A GitHub issue matches by linked issue; a service task by its id in the branch name (§7.5). */
function matches(
  worktree: Worktree,
  item: ZotzTaskBoardItem,
  repoIds: ReadonlySet<string>
): boolean {
  if (item.origin.kind === 'github') {
    const number = item.origin.row.content.number
    return repoIds.has(worktree.repoId) && number != null && worktree.linkedIssue === number
  }
  return (worktree.branch ?? '').toLowerCase().includes(item.origin.task.id.toLowerCase())
}

/** Links board tasks to Zotz workspaces and their agents, and starts a workspace from a task. */
export function useZotzTaskWorkspaces(): ZotzTaskWorkspaces {
  const worktreesByRepo = useAppStore(selectWorktreesByRepo)
  const openModal = useAppStore((s) => s.openModal)
  const { lookupSlug } = useRepoSlugIndex()
  const queue = useZotzAgentQueue()
  const worktrees = useMemo(() => getIndexedAllWorktrees(worktreesByRepo), [worktreesByRepo])

  const find = useCallback(
    (item: ZotzTaskBoardItem): ZotzTaskWorkspace | null => {
      const repo = item.origin.kind === 'github' ? item.origin.row.content.repository : null
      const repoIds = new Set(lookupSlug(repo).map((entry) => entry.id))
      const worktree = worktrees.find((entry) => matches(entry, item, repoIds))
      if (!worktree) {
        return null
      }
      const agent = queue.running.find((entry) => entry.worktreeId === worktree.id)
      return {
        worktreeId: worktree.id,
        name: worktree.displayName,
        agentState: agent?.state ?? null
      }
    },
    [lookupSlug, queue, worktrees]
  )

  const open = useCallback((workspace: ZotzTaskWorkspace) => {
    closeZotzBoard()
    activateAndRevealWorktree(workspace.worktreeId)
  }, [])

  const create = useCallback(
    (item: ZotzTaskBoardItem) => {
      closeZotzBoard()
      if (item.origin.kind === 'github') {
        const { row } = item.origin
        const repoId = lookupSlug(row.content.repository)[0]?.id
        openModal('new-workspace-composer', {
          linkedWorkItem:
            row.content.number != null && row.content.url
              ? {
                  provider: 'github',
                  type: row.itemType === 'PULL_REQUEST' ? 'pr' : 'issue',
                  number: row.content.number,
                  title: row.content.title,
                  url: row.content.url,
                  ...(repoId ? { repoId } : {})
                }
              : null,
          prefilledName: `${row.content.number ?? ''} ${row.content.title}`.trim(),
          ...(repoId ? { initialRepoId: repoId } : {}),
          enableIssueAutomation: row.itemType === 'ISSUE',
          telemetrySource: 'sidebar'
        })
        return
      }
      // The task id in the name ends up in the branch, so its PRs link themselves (§7.5).
      const { task } = item.origin
      openModal('new-workspace-composer', {
        prefilledName: `${task.id.toLowerCase()}-${slugify(task.title)}`,
        telemetrySource: 'sidebar'
      })
    },
    [lookupSlug, openModal]
  )

  return useMemo(() => ({ find, open, create }), [create, find, open])
}

export const ZotzTaskWorkspacesContext = createContext<ZotzTaskWorkspaces | null>(null)

export function useZotzTaskWorkspaceFor(item: ZotzTaskBoardItem): {
  workspace: ZotzTaskWorkspace | null
  actions: ZotzTaskWorkspaces | null
} {
  const actions = useContext(ZotzTaskWorkspacesContext)
  return { workspace: actions?.find(item) ?? null, actions }
}
