import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store/index'
import { selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'
import { createNonSecureContextUuid } from '../../../../../shared/identifiers/non-secure-context-uuid'
import { getRepoExecutionHostId } from '../../../../../shared/execution-host'
import { commitZotzLinks, type ZotzLinkContext } from './zotz-link-actions'
import type { ZotzLinkMember } from './zotz-link-groups'
import {
  placeZotzCreatedConversations,
  zotzPlacementKey,
  type ZotzCreatedConversation
} from './zotz-group-placement'

/** Puts conversations that agents create into their parent's group (or their `--group`), once each. */
export function useZotzGroupPlacement(context: ZotzLinkContext): void {
  const worktreesByRepo = useAppStore(selectWorktreesByRepo)
  const repos = useAppStore((s) => s.repos)
  const settingsLoaded = useAppStore((s) => s.settings !== null)
  const running = useRef(false)
  useEffect(() => {
    if (!settingsLoaded || running.current) {
      return
    }
    const created: ZotzCreatedConversation[] = []
    const byWorktree = new Map<string, ZotzLinkMember>()
    for (const repo of repos) {
      const hostId = getRepoExecutionHostId(repo)
      for (const worktree of worktreesByRepo[repo.id] ?? []) {
        const member = { hostId, path: worktree.path }
        byWorktree.set(`${hostId}\n${worktree.id}`, member)
        const provenance = worktree.cliProvenance
        if (
          provenance &&
          !worktree.isArchived &&
          (provenance.zotzGroup || provenance.zotzParentWorktreeId)
        ) {
          created.push({ member, worktreeId: worktree.id, provenance })
        }
      }
    }
    const settings = useAppStore.getState().settings
    const already = new Set(settings?.zotzPlacedConversations ?? [])
    const result = placeZotzCreatedConversations({
      groups: settings?.zotzConversationLinks ?? [],
      created,
      placed: already,
      memberOf: (hostId, worktreeId) => byWorktree.get(`${hostId}\n${worktreeId}`) ?? null,
      now: Date.now(),
      newId: createNonSecureContextUuid
    })
    if (result.placed.length === 0) {
      return
    }
    // Keep only conversations that still exist, so the list doesn't grow forever.
    const live = new Set(created.map((c) => zotzPlacementKey(c.member)))
    const placed = [...already, ...result.placed].filter((key) => live.has(key))
    running.current = true
    void (async () => {
      if (result.changed) {
        await commitZotzLinks(result.groups, context)
      }
      await useAppStore.getState().updateSettings({ zotzPlacedConversations: placed })
    })()
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : String(error))
      )
      .finally(() => {
        running.current = false
      })
  }, [worktreesByRepo, repos, settingsLoaded, context])
}
