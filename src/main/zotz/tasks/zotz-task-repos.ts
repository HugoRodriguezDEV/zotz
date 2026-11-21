import { runGraphql } from '../../github/project-view/project-graphql'
import type { ZotzRepoIssues } from '../../../shared/zotz/tasks/zotz-repo-issues'

const SLUG_PART = /^[\w.-]{1,100}$/

type RawIssue = {
  number?: number
  title?: string
  url?: string
  state?: string
  stateReason?: string | null
  updatedAt?: string
  labels?: { nodes?: ({ name?: string; color?: string } | null)[] }
  assignees?: { nodes?: ({ login?: string; name?: string | null; avatarUrl?: string } | null)[] }
  closedByPullRequestsReferences?: { totalCount?: number }
}

/** Repos an owner has, newest activity first, for the source picker. */
export async function listZotzOwnerRepos(
  owner: string,
  ownerType: 'organization' | 'user'
): Promise<{ ok: true; repos: string[] } | { ok: false; error: string }> {
  if (!SLUG_PART.test(owner)) {
    return { ok: false, error: 'Invalid owner' }
  }
  const root = ownerType === 'organization' ? 'organization' : 'user'
  const response = await runGraphql<
    Record<string, { repositories?: { nodes?: ({ nameWithOwner?: string } | null)[] } } | null>
  >(
    `query { owner: ${root}(login: "${owner}") { repositories(first: 100, orderBy: { field: PUSHED_AT, direction: DESC }, ownerAffiliations: OWNER) { nodes { nameWithOwner } } } }`,
    {}
  )
  if (!response.ok) {
    return { ok: false, error: response.error.message }
  }
  return {
    ok: true,
    repos: (response.data.owner?.repositories?.nodes ?? []).flatMap((node) =>
      node?.nameWithOwner ? [node.nameWithOwner] : []
    )
  }
}

/** The 100 most recently updated issues of each repo, open and closed. */
export async function fetchZotzRepoIssues(repos: readonly string[]): Promise<ZotzRepoIssues[]> {
  const valid = repos.flatMap((repo) => {
    const [owner, name, extra] = repo.split('/')
    return owner && name && !extra && SLUG_PART.test(owner) && SLUG_PART.test(name)
      ? [[owner, name] as const]
      : []
  })
  const result: ZotzRepoIssues[] = []
  for (let start = 0; start < valid.length; start += 5) {
    const batch = valid.slice(start, start + 5)
    const fields = batch
      .map(
        ([owner, name], index) =>
          `r${index}: repository(owner: "${owner}", name: "${name}") { nameWithOwner url issues(first: 100, orderBy: { field: UPDATED_AT, direction: DESC }) { nodes {
            number title url state stateReason updatedAt
            labels(first: 10) { nodes { name color } }
            assignees(first: 5) { nodes { login name avatarUrl } }
            closedByPullRequestsReferences(first: 1, includeClosedPrs: false) { totalCount }
          } } }`
      )
      .join('\n')
    const response = await runGraphql<
      Record<
        string,
        { nameWithOwner?: string; url?: string; issues?: { nodes?: (RawIssue | null)[] } } | null
      >
    >(`query {\n${fields}\n}`, {})
    if (!response.ok) {
      continue
    }
    batch.forEach((_repo, index) => {
      const raw = response.data[`r${index}`]
      if (!raw?.nameWithOwner || !raw.url) {
        return
      }
      result.push({
        repo: raw.nameWithOwner,
        url: raw.url,
        issues: (raw.issues?.nodes ?? []).flatMap((issue) =>
          issue?.number && issue.title && issue.url
            ? [
                {
                  number: issue.number,
                  title: issue.title,
                  url: issue.url,
                  state: issue.state === 'CLOSED' ? 'CLOSED' : 'OPEN',
                  stateReason: issue.stateReason ?? null,
                  updatedAt: issue.updatedAt ?? '',
                  labels: (issue.labels?.nodes ?? []).flatMap((label) =>
                    label?.name ? [{ name: label.name, color: label.color ?? '' }] : []
                  ),
                  assignees: (issue.assignees?.nodes ?? []).flatMap((user) =>
                    user?.login
                      ? [
                          {
                            login: user.login,
                            name: user.name ?? null,
                            avatarUrl: user.avatarUrl ?? null
                          }
                        ]
                      : []
                  ),
                  openClosingPullRequests: issue.closedByPullRequestsReferences?.totalCount ?? 0
                }
              ]
            : []
        )
      })
    })
  }
  return result
}

/** The signed-in account and every organization it belongs to, Projects or not. */
export async function listZotzOwners(): Promise<
  { login: string; ownerType: 'organization' | 'user' }[]
> {
  const response = await runGraphql<{
    viewer?: { login?: string; organizations?: { nodes?: ({ login?: string } | null)[] } }
  }>('query { viewer { login organizations(first: 100) { nodes { login } } } }', {})
  if (!response.ok || !response.data.viewer?.login) {
    return []
  }
  return [
    { login: response.data.viewer.login, ownerType: 'user' },
    ...(response.data.viewer.organizations?.nodes ?? []).flatMap((node) =>
      node?.login ? [{ login: node.login, ownerType: 'organization' as const }] : []
    )
  ]
}
