import { useEffect } from 'react'
import { useAppStore } from '@/store/index'
import {
  buildRepositoryGitHubAvatarUpdate,
  resolveRepositoryGitHubAvatar
} from '@/runtime/repository-github/repository-icon-github'
import { zotzRepoRuntimeTarget } from '../repo-github/use-zotz-repo-github-slug'
import { isFolderRepo } from '../../../../../shared/repository/repo-kind'
import type { Repo } from '../../../../../shared/repository/repo-types'

// One try per repo per launch: a repo without a GitHub remote keeps its folder icon quietly.
const attempted = new Set<string>()

async function applyGitHubAvatar(repo: Repo): Promise<void> {
  const resolution = await resolveRepositoryGitHubAvatar(zotzRepoRuntimeTarget(repo), repo)
  const latest = useAppStore.getState().repos.find((candidate) => candidate.id === repo.id)
  // The user may have picked an icon while this resolved.
  if (!resolution.repoIcon || !latest || latest.repoIcon) {
    return
  }
  const updates = buildRepositoryGitHubAvatarUpdate(latest, resolution)
  if (updates) {
    void useAppStore.getState().updateRepo(repo.id, updates)
  }
}

/** Projects without an icon take their GitHub owner's avatar, like Settings → "Use GitHub avatar". */
export function useZotzGitHubRepoIcons(repos: readonly Repo[]): void {
  useEffect(() => {
    for (const repo of repos) {
      if (repo.repoIcon || isFolderRepo(repo) || attempted.has(repo.id)) {
        continue
      }
      attempted.add(repo.id)
      void applyGitHubAvatar(repo).catch(() => {})
    }
  }, [repos])
}
