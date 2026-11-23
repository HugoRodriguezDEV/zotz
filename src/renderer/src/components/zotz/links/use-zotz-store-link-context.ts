import { useMemo } from 'react'
import { useAppStore } from '@/store/index'
import { findWorktreeById } from '@/store/github/refresh/worktree-refresh'
import { useZotzLinkHosts } from './use-zotz-link-data'
import type { ZotzLinkContext } from './zotz-link-actions'
import { findZotzLinkWorktreeId } from './zotz-link-worktrees'

/** Link context from what this window already lists, for changes made outside the links panel. */
export function useZotzStoreLinkContext(shortNames: ReadonlyMap<string, string>): ZotzLinkContext {
  const hosts = useZotzLinkHosts()
  return useMemo(
    () => ({
      hosts,
      describe: (member) => {
        const state = useAppStore.getState()
        const id = findZotzLinkWorktreeId(state, member)
        const worktree = id ? findWorktreeById(state, id) : null
        return id && worktree
          ? { shortName: shortNames.get(id) ?? '', title: worktree.displayName ?? '' }
          : null
      }
    }),
    [hosts, shortNames]
  )
}
