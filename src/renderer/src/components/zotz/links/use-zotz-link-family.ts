import { useMemo } from 'react'
import { useAppStore } from '@/store/index'
import { selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'
import type { ExecutionHostId } from '../../../../../shared/execution-host'
import type { ZotzConversationEntry } from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import type { ZotzHostConversations } from './use-zotz-link-data'
import { buildZotzFamilyIndex, type ZotzFamilyIndex } from './zotz-link-family'
import { findZotzLinkWorktree } from './zotz-link-worktrees'

/** Who created whom across every listed machine; falls back to this window's records for old hosts. */
export function useZotzLinkFamily(
  conversations: ReadonlyMap<ExecutionHostId, ZotzHostConversations>
): ZotzFamilyIndex {
  const repos = useAppStore((state) => state.repos)
  const worktreesByRepo = useAppStore(selectWorktreesByRepo)
  return useMemo(() => {
    const lists = new Map<ExecutionHostId, readonly ZotzConversationEntry[]>()
    for (const [hostId, list] of conversations) {
      if (list.status === 'ready') {
        lists.set(hostId, list.conversations)
      }
    }
    const state = { repos, worktreesByRepo }
    return buildZotzFamilyIndex(
      lists,
      (member) => findZotzLinkWorktree(state, member)?.cliProvenance?.zotzParentWorktreeId ?? null
    )
  }, [conversations, repos, worktreesByRepo])
}
