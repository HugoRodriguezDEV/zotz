import React from 'react'
import { useAppStore } from '@/store/index'
import { getRepoIdFromWorktreeId } from '../../../../../shared/worktree/id'
import { formatZotzRepoSlug, useZotzRepoGitHubSlug } from './use-zotz-repo-github-slug'
import { ZotzRepoGitHubLink } from './ZotzRepoGitHubLink'

/** The active conversation's GitHub repository, so a folder or group name never hides which repo it is. */
export function ZotzRepoGitHubStatusSegment({
  iconOnly
}: {
  iconOnly: boolean
}): React.JSX.Element | null {
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const repoId = activeWorktreeId ? getRepoIdFromWorktreeId(activeWorktreeId) : null
  const repo = useAppStore((s) => (repoId ? s.repos.find((r) => r.id === repoId) : undefined))
  const slug = useZotzRepoGitHubSlug(repo)
  if (!slug) {
    return null
  }
  return (
    <ZotzRepoGitHubLink
      slug={slug}
      className="px-1 py-0.5 text-muted-foreground hover:bg-accent/70"
      iconClassName="size-3"
    >
      {!iconOnly ? (
        <span className="truncate text-[11px] font-medium">{formatZotzRepoSlug(slug)}</span>
      ) : null}
    </ZotzRepoGitHubLink>
  )
}
