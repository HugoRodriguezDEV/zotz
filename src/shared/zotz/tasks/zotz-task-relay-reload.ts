import type { ZotzIssueRef } from './zotz-task-development-types'
import type { ZotzRelayNotice } from './zotz-task-relay-types'

/** A loaded board source, reduced to what tells whether a notice touches it. */
export type ZotzRelayBoardSource = {
  key: string
  /** owner/name for a repo source. */
  repo?: string
  /** GitHub node id of a loaded Project. */
  projectNodeId?: string
  items: readonly { repo: string; number: number; isIssue: boolean }[]
}

export type ZotzRelayReloadPlan = {
  /** Reload everything, like the Refresh button. */
  full: boolean
  /** Board sources (Projects or repos) to reread from GitHub. */
  sourceKeys: string[]
  /** Issues whose Development (PRs, branches, mentions) to reread. */
  developmentRefs: ZotzIssueRef[]
  /** Rematch services' tasks to PRs (and send link-pr). */
  connectorPullRequests: boolean
}

const same = (a: string | undefined, b: string | undefined): boolean =>
  a !== undefined && b !== undefined && a.toLowerCase() === b.toLowerCase()

/**
 * Turns relay notices into the smallest reload that covers them:
 * - issue changed → the repo source and every Project holding it, plus its Development;
 * - PR changed → same for the PR (it can be a Project item and moves derived repo statuses),
 *   the Development of the repo's issues on the board, and services' PR matching;
 * - push → Development of the repo's issues (branches, PR commits) and services' PR matching;
 * - Project item changed (org Projects only) → that Project;
 * - App installed or repos added → everything.
 * Repos and Projects that aren't on the board are ignored; provider pushes are handled in main.
 */
export function planZotzRelayReload(
  notices: readonly ZotzRelayNotice[],
  board: { sources: readonly ZotzRelayBoardSource[]; watchedRepos: readonly string[] }
): ZotzRelayReloadPlan {
  const sourceKeys = new Set<string>()
  const development = new Map<string, ZotzIssueRef>()
  let connectorPullRequests = false
  const addIssue = (repo: string, number: number): void => {
    development.set(`${repo.toLowerCase()}#${number}`, { repo, number })
  }
  const watches = (repo: string | undefined): boolean =>
    board.watchedRepos.some((watched) => same(watched, repo))

  for (const notice of notices) {
    const { repo, number } = notice
    switch (notice.kind) {
      case 'installation':
        return { full: true, sourceKeys: [], developmentRefs: [], connectorPullRequests: false }
      case 'issues':
      case 'pull_request': {
        for (const source of board.sources) {
          const holds = source.items.find((item) => same(item.repo, repo) && item.number === number)
          if (same(source.repo, repo) || holds) {
            sourceKeys.add(source.key)
          }
          if (holds?.isIssue && notice.kind === 'issues') {
            addIssue(holds.repo, holds.number)
          }
        }
        if (notice.kind === 'pull_request') {
          addRepoIssues(board.sources, repo, addIssue)
          connectorPullRequests ||= watches(repo)
        }
        break
      }
      case 'push':
        addRepoIssues(board.sources, repo, addIssue)
        connectorPullRequests ||= watches(repo)
        break
      case 'projects_v2_item':
        for (const source of board.sources) {
          if (source.projectNodeId !== undefined && source.projectNodeId === notice.projectNodeId) {
            sourceKeys.add(source.key)
          }
        }
        break
      case 'source_push':
        break
    }
  }
  return {
    full: false,
    sourceKeys: [...sourceKeys],
    developmentRefs: [...development.values()],
    connectorPullRequests
  }
}

/** A PR or push can link to any issue of its repo, so every board issue there is reread. */
function addRepoIssues(
  sources: readonly ZotzRelayBoardSource[],
  repo: string | undefined,
  add: (repo: string, number: number) => void
): void {
  for (const source of sources) {
    for (const item of source.items) {
      if (item.isIssue && same(item.repo, repo)) {
        add(item.repo, item.number)
      }
    }
  }
}
