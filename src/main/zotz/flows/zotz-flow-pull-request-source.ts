import { runGraphql } from '../../github/project-view/project-graphql'
import type { ZotzFlowPullRequestAction } from '../../../shared/zotz/flows/zotz-flow-trigger-contract'
import type { ZotzRelayNotice } from '../../../shared/zotz/tasks/zotz-task-relay-types'
import type { ZotzFlowEventDispatcher, ZotzFlowEventPayload } from './zotz-flow-event-dispatch'
import type { ZotzFlowEventMemory } from './zotz-flow-event-memory'
import { zotzFlowFilterMatches, zotzFlowPullRequestMatches } from './zotz-flow-trigger-match'

const SLUG_PART = /^[\w.-]{1,100}$/
const POLL_MS = 2 * 60_000
// An event older than this when first seen (long downtime, relay outage) is history, not news.
const MAX_EVENT_AGE_MS = 24 * 60 * 60_000
const RECENT_PER_REPO = 30
const REPOS_PER_QUERY = 10

const PR_FIELDS = `number title body url state baseRefName headRefName createdAt mergedAt
  author { login }
  repository { nameWithOwner }
  labels(first: 20) { nodes { name } }
  files(first: 100) { nodes { path } }`

type RawPullRequest = {
  number?: number
  title?: string
  body?: string
  url?: string
  state?: string
  baseRefName?: string
  headRefName?: string
  createdAt?: string
  mergedAt?: string | null
  author?: { login?: string } | null
  repository?: { nameWithOwner?: string }
  labels?: { nodes?: ({ name?: string } | null)[] } | null
  files?: { nodes?: ({ path?: string } | null)[] } | null
}

export type ZotzFlowPullRequest = ZotzFlowEventPayload<'pull_request'>['pr'] & {
  labels: string[]
  merged: boolean
  createdAt: number
  mergedAt: number | null
}

function splitRepo(repo: string): [string, string] | null {
  const [owner, name, extra] = repo.split('/')
  return owner && name && !extra && SLUG_PART.test(owner) && SLUG_PART.test(name)
    ? [owner, name]
    : null
}

function toPullRequest(raw: RawPullRequest | null | undefined): ZotzFlowPullRequest | null {
  const repo = raw?.repository?.nameWithOwner
  if (!raw?.number || !raw.url || !repo) {
    return null
  }
  const mergedAt = raw.mergedAt ? Date.parse(raw.mergedAt) : Number.NaN
  return {
    number: raw.number,
    title: raw.title ?? '',
    body: raw.body ?? '',
    repo,
    branch: raw.headRefName ?? '',
    baseBranch: raw.baseRefName ?? '',
    author: raw.author?.login ?? '',
    url: raw.url,
    changedFiles: (raw.files?.nodes ?? []).flatMap((node) => (node?.path ? [node.path] : [])),
    labels: (raw.labels?.nodes ?? []).flatMap((node) => (node?.name ? [node.name] : [])),
    merged: raw.state === 'MERGED',
    createdAt: raw.createdAt ? Date.parse(raw.createdAt) : 0,
    mergedAt: Number.isFinite(mergedAt) ? mergedAt : null
  }
}

/** The most recently updated PRs of each repo, through Zotz's own `gh` account. */
async function fetchRecentPullRequests(repos: readonly string[]): Promise<{
  read: Set<string>
  pullRequests: ZotzFlowPullRequest[]
}> {
  const valid = repos.flatMap((repo) => {
    const parts = splitRepo(repo)
    return parts ? [{ repo, parts }] : []
  })
  const read = new Set<string>()
  const pullRequests: ZotzFlowPullRequest[] = []
  for (let start = 0; start < valid.length; start += REPOS_PER_QUERY) {
    const batch = valid.slice(start, start + REPOS_PER_QUERY)
    const fields = batch
      .map(
        ({ parts: [owner, name] }, index) =>
          `r${index}: repository(owner: "${owner}", name: "${name}") { pullRequests(first: ${RECENT_PER_REPO}, orderBy: { field: UPDATED_AT, direction: DESC }) { nodes { ${PR_FIELDS} } } }`
      )
      .join('\n')
    const response = await runGraphql<
      Record<string, { pullRequests?: { nodes?: (RawPullRequest | null)[] } } | null>
    >(`query {\n${fields}\n}`, {})
    if (!response.ok) {
      console.warn('[zotz-flows] could not read pull requests:', response.error.message)
      continue
    }
    batch.forEach(({ repo }, index) => {
      const nodes = response.data[`r${index}`]?.pullRequests?.nodes
      if (nodes) {
        read.add(repo.toLowerCase())
      }
      for (const node of nodes ?? []) {
        const pullRequest = toPullRequest(node)
        if (pullRequest) {
          pullRequests.push(pullRequest)
        }
      }
    })
  }
  return { read, pullRequests }
}

async function fetchPullRequest(repo: string, number: number): Promise<ZotzFlowPullRequest | null> {
  const parts = splitRepo(repo)
  if (!parts) {
    return null
  }
  const response = await runGraphql<{ repository?: { pullRequest?: RawPullRequest | null } }>(
    `query { repository(owner: "${parts[0]}", name: "${parts[1]}") { pullRequest(number: ${number}) { ${PR_FIELDS} } } }`,
    {}
  )
  return response.ok ? toPullRequest(response.data.repository?.pullRequest) : null
}

/** Which action a relay notice means; reopened and edits are not trigger events. */
export function zotzFlowRelayPullRequestAction(
  notice: Pick<ZotzRelayNotice, 'kind' | 'action'>
): 'opened' | 'closed' | null {
  if (notice.kind !== 'pull_request') {
    return null
  }
  return notice.action === 'opened' ? 'opened' : notice.action === 'closed' ? 'closed' : null
}

export type ZotzFlowPullRequestSourceDeps = {
  dispatcher: ZotzFlowEventDispatcher
  memory: ZotzFlowEventMemory
  /** owner/name of this machine's repos, for PR triggers that name no repo. */
  localRepos: () => Promise<string[]>
  relay: {
    live: () => boolean
    subscribe: (listener: (notices: readonly ZotzRelayNotice[]) => void) => () => void
  }
  now: () => number
}

/**
 * "PR opened or merged" (spec §4.2): at once from the relay's webhook notices when it is on,
 * otherwise by polling the repos the enabled flows ask for. Each PR and action fires once,
 * remembered on disk, so the relay and the poll never double up and a restart never repeats.
 */
export function watchZotzFlowPullRequests(deps: ZotzFlowPullRequestSourceDeps): () => void {
  const { dispatcher, memory } = deps
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const announce = (pullRequest: ZotzFlowPullRequest, action: ZotzFlowPullRequestAction): void => {
    const key = `pr:${pullRequest.repo.toLowerCase()}#${pullRequest.number}:${action}`
    if (!memory.claim(key, deps.now())) {
      return
    }
    const { labels, merged: _merged, createdAt: _created, mergedAt: _mergedAt, ...pr } = pullRequest
    dispatcher.fire(
      'pull_request',
      { kind: 'pull_request', action, pr },
      (trigger) =>
        zotzFlowPullRequestMatches(trigger, {
          action,
          repo: pr.repo,
          baseBranch: pr.baseBranch,
          author: pr.author,
          labels
        }),
      // A PR names no Zotz session or workspace; the hourly cap bounds a flow that opens PRs.
      null
    )
  }

  const announceRecent = (pullRequest: ZotzFlowPullRequest, since: number): void => {
    const oldest = Math.max(since, deps.now() - MAX_EVENT_AGE_MS)
    if (pullRequest.createdAt >= oldest) {
      announce(pullRequest, 'opened')
    }
    if (pullRequest.merged && pullRequest.mergedAt !== null && pullRequest.mergedAt >= oldest) {
      announce(pullRequest, 'merged')
    }
  }

  const reposToPoll = async (): Promise<string[]> => {
    const triggers = dispatcher.triggers('pull_request')
    const named = triggers.flatMap((trigger) => (trigger.repo ? [trigger.repo] : []))
    const everyRepo = triggers.some((trigger) => !trigger.repo)
    const all = everyRepo ? [...named, ...(await deps.localRepos())] : named
    return [...new Map(all.map((repo) => [repo.toLowerCase(), repo])).values()]
  }

  const poll = async (): Promise<void> => {
    if (!dispatcher.wanted('pull_request') || deps.relay.live()) {
      return
    }
    const repos = await reposToPoll()
    const { read, pullRequests } = await fetchRecentPullRequests(repos)
    const now = deps.now()
    // The first read of a repo only marks where news starts.
    const since = new Map([...read].map((repo) => [repo, memory.baseline(`pr-poll:${repo}`, now)]))
    for (const pullRequest of pullRequests) {
      const repoSince = since.get(pullRequest.repo.toLowerCase())
      if (repoSince !== undefined && repoSince < now) {
        announceRecent(pullRequest, repoSince)
      }
    }
  }

  const loop = (): void => {
    timer = null
    void poll()
      .catch((error) => console.warn('[zotz-flows] pull request poll failed:', error))
      .finally(() => {
        if (!stopped) {
          timer = setTimeout(loop, POLL_MS)
          timer.unref?.()
        }
      })
  }

  const onNotices = (notices: readonly ZotzRelayNotice[]): void => {
    for (const notice of notices) {
      const action = zotzFlowRelayPullRequestAction(notice)
      const { repo, number } = notice
      if (
        !action ||
        !repo ||
        !number ||
        !dispatcher
          .triggers('pull_request')
          .some((trigger) => zotzFlowFilterMatches(trigger.repo, [repo]))
      ) {
        continue
      }
      void fetchPullRequest(repo, number).then((pullRequest) => {
        if (!pullRequest || stopped) {
          return
        }
        if (action === 'opened') {
          announce(pullRequest, 'opened')
        } else if (pullRequest.merged) {
          announce(pullRequest, 'merged')
        }
      })
    }
  }

  const stopRelay = deps.relay.subscribe(onNotices)
  loop()
  return () => {
    stopped = true
    stopRelay()
    if (timer !== null) {
      clearTimeout(timer)
    }
  }
}
