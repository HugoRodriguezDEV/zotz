import { describe, expect, it } from 'vitest'
import type { ZotzPullRequestInfo } from './zotz-task-development-types'
import { isSafeTaskIdPattern, matchZotzTaskPullRequests } from './zotz-task-pr-matching'
import { parseZotzTasks } from './zotz-tasks-contract'

function feed(taskIdPattern?: string) {
  const result = parseZotzTasks(
    JSON.stringify({
      schema: 'zotz-tasks/v1',
      source: {
        id: 'hd',
        name: 'Helpdesk',
        ...(taskIdPattern ? { taskIdPattern } : {}),
        fields: [{ name: 'Status', type: 'single-select', options: [{ id: 'new', name: 'New' }] }]
      },
      tasks: [
        { id: 'HD-142', title: 'Login', state: 'open', fieldValues: { Status: 'new' } },
        {
          id: 'HD-7',
          title: 'Export',
          state: 'open',
          fieldValues: { Status: 'new' },
          pullRequests: [{ repo: 'acme/web', number: 3 }]
        }
      ]
    })
  )
  if (!result.ok) {
    throw new Error(result.error)
  }
  return result.document
}

function pr(
  number: number,
  headRef: string,
  title: string,
  body = ''
): ZotzPullRequestInfo & { body: string } {
  return {
    repo: 'acme/web',
    number,
    title,
    url: `https://github.com/acme/web/pull/${number}`,
    state: 'open',
    isDraft: false,
    baseRef: 'main',
    headRef,
    author: null,
    additions: 0,
    deletions: 0,
    changedFiles: 0,
    mergedAt: null,
    mergeCommit: null,
    files: [],
    body
  }
}

describe('matchZotzTaskPullRequests', () => {
  it('links by branch or title and only mentions by body', () => {
    const matches = matchZotzTaskPullRequests(feed('HD-[0-9]+'), [
      pr(1, 'hd-142-login-safari', 'Fix login'),
      pr(2, 'chore/deps', 'Bump deps', 'Unblocks HD-142 later'),
      pr(4, 'feature/x', 'HD-999 is not a task')
    ])
    expect(matches['HD-142']?.map((match) => [match.pullRequest.number, match.link])).toEqual([
      [1, 'linked'],
      [2, 'mentioned']
    ])
    expect(Object.keys(matches)).toEqual(['HD-142'])
  })

  it('uses the literal ids without a pattern and honors PRs the service declares', () => {
    const matches = matchZotzTaskPullRequests(feed(), [
      pr(3, 'misc', 'Unrelated title'),
      pr(5, 'x', 'HD-142: login')
    ])
    expect(matches['HD-7']?.map((match) => [match.pullRequest.number, match.link])).toEqual([
      [3, 'linked']
    ])
    expect(matches['HD-142']?.map((match) => match.pullRequest.number)).toEqual([5])
  })
})

describe('isSafeTaskIdPattern', () => {
  it('refuses nested quantifiers and broken patterns', () => {
    expect(isSafeTaskIdPattern('HD-[0-9]+')).toBe(true)
    expect(isSafeTaskIdPattern('(a+)+')).toBe(false)
    expect(isSafeTaskIdPattern('([a-z]*)*x')).toBe(false)
    expect(isSafeTaskIdPattern('HD-[')).toBe(false)
  })
})
