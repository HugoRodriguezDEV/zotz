import { runGraphql } from '../../github/project-view/project-graphql'
import {
  zotzIssueRefKey,
  type ZotzIssueRef,
  type ZotzPullRequestInfo,
  type ZotzTaskDevelopment
} from '../../../shared/zotz/tasks/zotz-task-development-types'

const BATCH_SIZE = 20
const SLUG_PART = /^[\w.-]{1,100}$/

type RawPullRequest = {
  number?: number
  title?: string
  url?: string
  state?: string
  isDraft?: boolean
  baseRefName?: string
  headRefName?: string
  body?: string
  author?: { login?: string } | null
  additions?: number
  deletions?: number
  changedFiles?: number
  mergedAt?: string | null
  mergeCommit?: { oid?: string; abbreviatedOid?: string } | null
  repository?: { nameWithOwner?: string }
  files?: { nodes?: ({ path?: string } | null)[] } | null
}

type RawIssue = {
  closedByPullRequestsReferences?: { nodes?: (RawPullRequest | null)[] }
  linkedBranches?: { nodes?: ({ ref?: { name?: string } | null } | null)[] }
  timelineItems?: { nodes?: ({ source?: RawPullRequest | null } | null)[] }
}

const PULL_REQUEST_FIELDS = `
  number title url state isDraft baseRefName headRefName
  author { login }
  additions deletions changedFiles mergedAt
  mergeCommit { oid abbreviatedOid }
  repository { nameWithOwner }
  files(first: 5) { nodes { path } }`

function splitRepo(repo: string): [string, string] | null {
  const [owner, name, extra] = repo.split('/')
  return owner && name && !extra && SLUG_PART.test(owner) && SLUG_PART.test(name)
    ? [owner, name]
    : null
}

export function toPullRequestInfo(
  raw: RawPullRequest | null | undefined
): ZotzPullRequestInfo | null {
  if (!raw?.number || !raw.url || !raw.repository?.nameWithOwner) {
    return null
  }
  const state = raw.state === 'MERGED' ? 'merged' : raw.state === 'CLOSED' ? 'closed' : 'open'
  return {
    repo: raw.repository.nameWithOwner,
    number: raw.number,
    title: raw.title ?? '',
    url: raw.url,
    state,
    isDraft: raw.isDraft === true,
    baseRef: raw.baseRefName ?? '',
    headRef: raw.headRefName ?? '',
    author: raw.author?.login ?? null,
    additions: raw.additions ?? 0,
    deletions: raw.deletions ?? 0,
    changedFiles: raw.changedFiles ?? 0,
    mergedAt: raw.mergedAt ?? null,
    mergeCommit:
      raw.mergeCommit?.oid && raw.mergeCommit.abbreviatedOid
        ? { oid: raw.mergeCommit.oid, abbreviatedOid: raw.mergeCommit.abbreviatedOid }
        : null,
    files: (raw.files?.nodes ?? []).flatMap((node) => (node?.path ? [node.path] : []))
  }
}

function development(raw: RawIssue | null | undefined, now: number): ZotzTaskDevelopment {
  const linked = (raw?.closedByPullRequestsReferences?.nodes ?? []).flatMap((node) => {
    const info = toPullRequestInfo(node)
    return info ? [info] : []
  })
  const linkedUrls = new Set(linked.map((pullRequest) => pullRequest.url))
  const mentioned = new Map<string, ZotzPullRequestInfo>()
  for (const node of raw?.timelineItems?.nodes ?? []) {
    const info = toPullRequestInfo(node?.source)
    if (info && !linkedUrls.has(info.url)) {
      mentioned.set(info.url, info)
    }
  }
  return {
    linked,
    mentioned: [...mentioned.values()],
    branches: (raw?.linkedBranches?.nodes ?? []).flatMap((node) =>
      node?.ref?.name ? [node.ref.name] : []
    ),
    verifiedAt: now
  }
}

/**
 * Linked PRs, linked branches and PRs that only mention each issue, read in batches of 20
 * aliased issues per GraphQL call. A batch GitHub refuses leaves its issues out of the result.
 */
export async function fetchZotzIssueDevelopment(
  refs: readonly ZotzIssueRef[]
): Promise<Record<string, ZotzTaskDevelopment>> {
  const valid = refs.flatMap((ref) => {
    const parts = splitRepo(ref.repo)
    return parts && Number.isInteger(ref.number) && ref.number > 0 ? [{ ref, parts }] : []
  })
  const result: Record<string, ZotzTaskDevelopment> = {}
  for (let start = 0; start < valid.length; start += BATCH_SIZE) {
    const batch = valid.slice(start, start + BATCH_SIZE)
    const fields = batch
      .map(
        ({ ref, parts: [owner, name] }, index) =>
          `i${index}: repository(owner: "${owner}", name: "${name}") { issue(number: ${ref.number}) { ...Development } }`
      )
      .join('\n')
    const query = `query {\n${fields}\n}
fragment PullRequestFields on PullRequest {${PULL_REQUEST_FIELDS}}
fragment Development on Issue {
  closedByPullRequestsReferences(first: 10, includeClosedPrs: true) { nodes { ...PullRequestFields } }
  linkedBranches(first: 5) { nodes { ref { name } } }
  timelineItems(itemTypes: [CROSS_REFERENCED_EVENT], last: 20) {
    nodes { ... on CrossReferencedEvent { source { ... on PullRequest { ...PullRequestFields } } } }
  }
}`
    const response = await runGraphql<Record<string, { issue?: RawIssue | null } | null>>(query, {})
    if (!response.ok) {
      continue
    }
    const now = Date.now()
    batch.forEach(({ ref }, index) => {
      result[zotzIssueRefKey(ref)] = development(response.data[`i${index}`]?.issue, now)
    })
  }
  return result
}

/** The 50 most recently updated PRs of each repo, with their bodies, for matching task ids. */
export async function fetchZotzRecentPullRequests(
  repos: readonly string[]
): Promise<(ZotzPullRequestInfo & { body: string })[]> {
  const valid = [...new Set(repos.map((repo) => repo.toLowerCase()))].flatMap((repo) => {
    const parts = splitRepo(repo)
    return parts ? [parts] : []
  })
  const found: (ZotzPullRequestInfo & { body: string })[] = []
  for (let start = 0; start < valid.length; start += 10) {
    const batch = valid.slice(start, start + 10)
    const fields = batch
      .map(
        ([owner, name], index) =>
          `r${index}: repository(owner: "${owner}", name: "${name}") { pullRequests(first: 50, orderBy: { field: UPDATED_AT, direction: DESC }) { nodes { ${PULL_REQUEST_FIELDS} body } } }`
      )
      .join('\n')
    const response = await runGraphql<
      Record<string, { pullRequests?: { nodes?: (RawPullRequest | null)[] } } | null>
    >(`query {\n${fields}\n}`, {})
    if (!response.ok) {
      continue
    }
    batch.forEach((_repo, index) => {
      for (const node of response.data[`r${index}`]?.pullRequests?.nodes ?? []) {
        const info = toPullRequestInfo(node)
        if (info) {
          found.push({ ...info, body: node?.body ?? '' })
        }
      }
    })
  }
  return found
}

/** Specific pull requests a service declared on its tasks, read in batches like issues. */
export async function fetchZotzPullRequests(
  refs: readonly { repo: string; number: number }[]
): Promise<ZotzPullRequestInfo[]> {
  const valid = refs.flatMap((ref) => {
    const parts = splitRepo(ref.repo)
    return parts && Number.isInteger(ref.number) && ref.number > 0 ? [{ ref, parts }] : []
  })
  const found: ZotzPullRequestInfo[] = []
  for (let start = 0; start < valid.length; start += BATCH_SIZE) {
    const batch = valid.slice(start, start + BATCH_SIZE)
    const fields = batch
      .map(
        ({ ref, parts: [owner, name] }, index) =>
          `p${index}: repository(owner: "${owner}", name: "${name}") { pullRequest(number: ${ref.number}) { ${PULL_REQUEST_FIELDS} } }`
      )
      .join('\n')
    const response = await runGraphql<
      Record<string, { pullRequest?: RawPullRequest | null } | null>
    >(`query {\n${fields}\n}`, {})
    if (!response.ok) {
      continue
    }
    batch.forEach((_ref, index) => {
      const info = toPullRequestInfo(response.data[`p${index}`]?.pullRequest)
      if (info) {
        found.push(info)
      }
    })
  }
  return found
}

export async function fetchZotzViewerLogin(): Promise<string | null> {
  const response = await runGraphql<{ viewer?: { login?: string } }>(
    'query { viewer { login } }',
    {}
  )
  return response.ok ? (response.data.viewer?.login ?? null) : null
}
