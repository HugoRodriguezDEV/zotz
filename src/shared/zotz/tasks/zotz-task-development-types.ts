/** A GitHub pull request as the task board shows it under "Development". */
export type ZotzPullRequestInfo = {
  /** owner/name */
  repo: string
  number: number
  title: string
  url: string
  state: 'open' | 'merged' | 'closed'
  isDraft: boolean
  baseRef: string
  headRef: string
  author: string | null
  additions: number
  deletions: number
  changedFiles: number
  mergedAt: string | null
  mergeCommit: { oid: string; abbreviatedOid: string } | null
  /** First few changed paths; `changedFiles` has the total. */
  files: string[]
}

export type ZotzPullRequestLink = 'linked' | 'mentioned'

export type ZotzTaskDevelopment = {
  linked: ZotzPullRequestInfo[]
  /** Pull requests that name the task without closing or linking it. */
  mentioned: ZotzPullRequestInfo[]
  branches: string[]
  verifiedAt: number
}

export type ZotzIssueRef = { repo: string; number: number }

export function zotzIssueRefKey(ref: ZotzIssueRef): string {
  return `${ref.repo.toLowerCase()}#${ref.number}`
}

/** The most advanced pull request decides a card's PR line: merged, then open, then closed. */
export function zotzLeadPullRequest(
  pullRequests: readonly ZotzPullRequestInfo[]
): ZotzPullRequestInfo | null {
  const rank = { merged: 0, open: 1, closed: 2 } as const
  return [...pullRequests].sort((a, b) => rank[a.state] - rank[b.state])[0] ?? null
}
