import { useMemo } from 'react'
import { useAppStore } from '@/store/index'
import { selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'
import { getIndexedAllWorktrees } from '@/store/slices/worktrees/listing/worktree-catalog-index'

/** A conversation's display name by worktree id, falling back to the id; '' for none. */
export function useZotzWorkspaceNames(): (worktreeId: string | null) => string {
  const worktreesByRepo = useAppStore(selectWorktreesByRepo)
  const names = useMemo(
    () =>
      new Map(
        getIndexedAllWorktrees(worktreesByRepo).map((worktree) => [
          worktree.id,
          worktree.displayName
        ])
      ),
    [worktreesByRepo]
  )
  return (worktreeId) => (worktreeId ? (names.get(worktreeId) ?? worktreeId) : '')
}
