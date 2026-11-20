import type { ZotzPullRequestInfo, ZotzPullRequestLink } from './zotz-task-development-types'
import type { ZotzTasksDocument } from './zotz-tasks-contract'

export type ZotzMatchedPullRequest = { pullRequest: ZotzPullRequestInfo; link: ZotzPullRequestLink }

/** Nested quantifiers like (a+)+ can hang the matcher on a crafted branch name; refuse them. */
export function isSafeTaskIdPattern(pattern: string): boolean {
  if (pattern.length === 0 || pattern.length > 200) {
    return false
  }
  if (/\([^)]*[+*}][^)]*\)\s*[+*{?]/.test(pattern) || /\\\d/.test(pattern)) {
    return false
  }
  try {
    new RegExp(pattern)
    return true
  } catch {
    return false
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Task ids found in a text, upper-cased; falls back to the literal ids when there is no pattern. */
function idsIn(text: string, matcher: RegExp): Set<string> {
  return new Set([...text.matchAll(matcher)].map((match) => match[0].toUpperCase()))
}

/**
 * Finds the pull requests that belong to each task. The id in the branch name or the title
 * links the PR (like GitHub's closing keywords); the id only in the body is a mention.
 */
export function matchZotzTaskPullRequests(
  document: ZotzTasksDocument,
  pullRequests: readonly (ZotzPullRequestInfo & { body?: string })[]
): Record<string, ZotzMatchedPullRequest[]> {
  const taskIds = new Map(document.tasks.map((task) => [task.id.toUpperCase(), task.id]))
  const pattern = document.source.taskIdPattern
  const source =
    pattern && isSafeTaskIdPattern(pattern)
      ? pattern
      : [...taskIds.keys()]
          .sort((a, b) => b.length - a.length)
          .map(escapeRegExp)
          .join('|')
  if (!source) {
    return {}
  }
  const matcher = new RegExp(source, 'gi')
  const result: Record<string, ZotzMatchedPullRequest[]> = {}
  const add = (taskId: string, match: ZotzMatchedPullRequest): void => {
    const list = (result[taskId] ??= [])
    const existing = list.find((item) => item.pullRequest.url === match.pullRequest.url)
    if (!existing) {
      list.push(match)
    } else if (match.link === 'linked') {
      existing.link = 'linked'
    }
  }
  for (const pullRequest of pullRequests) {
    const linking = idsIn(`${pullRequest.headRef} ${pullRequest.title}`, matcher)
    const mentioning = idsIn(pullRequest.body ?? '', matcher)
    for (const id of linking) {
      const taskId = taskIds.get(id)
      if (taskId) {
        add(taskId, { pullRequest, link: 'linked' })
      }
    }
    for (const id of mentioning) {
      const taskId = taskIds.get(id)
      if (taskId && !linking.has(id)) {
        add(taskId, { pullRequest, link: 'mentioned' })
      }
    }
  }
  // A PR the service already lists on the task is linked, whatever its branch says.
  for (const task of document.tasks) {
    for (const declared of task.pullRequests) {
      const pullRequest = pullRequests.find(
        (item) =>
          item.repo.toLowerCase() === declared.repo.toLowerCase() && item.number === declared.number
      )
      if (pullRequest) {
        add(task.id, { pullRequest, link: 'linked' })
      }
    }
  }
  return result
}
