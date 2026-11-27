import { useEffect, useState } from 'react'
import { resolveRepositorySlugLive } from '@/runtime/repository-github/repository-icon-github'
import { runtimeTargetForOwnerEnvironment } from '@/runtime/rpc/targets/runtime-client-target'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type { GitHubRepositoryIdentity } from '../../../../../shared/github/repositories/repository-identity'
import { getRepoExecutionHostId, parseExecutionHostId } from '../../../../../shared/execution-host'
import { isFolderRepo } from '../../../../../shared/repository/repo-kind'
import type { Repo } from '../../../../../shared/repository/repo-types'

export function zotzRepoRuntimeTarget(repo: Repo): RuntimeClientTarget {
  const host = parseExecutionHostId(getRepoExecutionHostId(repo))
  return runtimeTargetForOwnerEnvironment(host?.kind === 'runtime' ? host.environmentId : null)
}

const pending = new Map<string, Promise<GitHubRepositoryIdentity | null>>()
const settled = new Map<string, GitHubRepositoryIdentity | null>()

function slugKey(repo: Repo): string {
  return `${getRepoExecutionHostId(repo)}\0${repo.id}\0${repo.path}`
}

function resolveSlug(repo: Repo): Promise<GitHubRepositoryIdentity | null> {
  const key = slugKey(repo)
  let request = pending.get(key)
  if (!request) {
    request = resolveRepositorySlugLive(zotzRepoRuntimeTarget(repo), repo).then(
      (slug) => {
        settled.set(key, slug)
        return slug
      },
      () => {
        // A failed read (offline host, git hiccup) retries on the next mount instead of sticking.
        pending.delete(key)
        return null
      }
    )
    pending.set(key, request)
  }
  return request
}

/** The origin remote's owner/repo on GitHub, so a project shows which repository it is. */
export function useZotzRepoGitHubSlug(repo: Repo | undefined): GitHubRepositoryIdentity | null {
  const key = repo && !isFolderRepo(repo) ? slugKey(repo) : null
  const [slug, setSlug] = useState<{ key: string; value: GitHubRepositoryIdentity | null } | null>(
    null
  )
  useEffect(() => {
    if (!repo || !key || settled.has(key)) {
      return
    }
    let live = true
    void resolveSlug(repo).then((value) => {
      if (live) {
        setSlug({ key, value })
      }
    })
    return () => {
      live = false
    }
  }, [repo, key])
  if (!key) {
    return null
  }
  return settled.get(key) ?? (slug?.key === key ? slug.value : null)
}

export function formatZotzRepoSlug(slug: GitHubRepositoryIdentity): string {
  return `${slug.owner}/${slug.repo}`
}
