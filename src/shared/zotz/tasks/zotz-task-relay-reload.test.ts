import { describe, expect, it } from 'vitest'
import { planZotzRelayReload, type ZotzRelayBoardSource } from './zotz-task-relay-reload'
import type { ZotzRelayNotice } from './zotz-task-relay-types'

const sources: ZotzRelayBoardSource[] = [
  {
    key: 'github.com/organization/acme/1',
    projectNodeId: 'PVT_acme1',
    items: [
      { repo: 'acme/api', number: 7, isIssue: true },
      { repo: 'acme/api', number: 9, isIssue: false },
      { repo: 'acme/web', number: 3, isIssue: true }
    ]
  },
  { key: 'github.com/user/hugo/2', projectNodeId: 'PVT_hugo2', items: [] },
  {
    key: 'github.com/repo/acme/web',
    repo: 'acme/web',
    items: [
      { repo: 'acme/web', number: 3, isIssue: true },
      { repo: 'acme/web', number: 4, isIssue: true }
    ]
  }
]
const board = { sources, watchedRepos: ['acme/web'] }

function notice(fields: Partial<ZotzRelayNotice> & Pick<ZotzRelayNotice, 'kind'>) {
  return { cursor: '1', action: 'edited', at: '2026-11-20T12:00:00Z', ...fields }
}

describe('planZotzRelayReload', () => {
  it('rereads the Projects and repo holding an issue, and its Development', () => {
    expect(
      planZotzRelayReload([notice({ kind: 'issues', repo: 'Acme/Web', number: 3 })], board)
    ).toEqual({
      full: false,
      sourceKeys: ['github.com/organization/acme/1', 'github.com/repo/acme/web'],
      developmentRefs: [{ repo: 'acme/web', number: 3 }],
      connectorPullRequests: false
    })
  })

  it('rereads a new issue of a chosen repo even before it is on the board', () => {
    expect(
      planZotzRelayReload([notice({ kind: 'issues', repo: 'acme/web', number: 99 })], board)
    ).toEqual({
      full: false,
      sourceKeys: ['github.com/repo/acme/web'],
      developmentRefs: [],
      connectorPullRequests: false
    })
  })

  it('on a PR, rereads Projects holding it, the repo issues Development and services matching', () => {
    expect(
      planZotzRelayReload([notice({ kind: 'pull_request', repo: 'acme/api', number: 9 })], board)
    ).toEqual({
      full: false,
      sourceKeys: ['github.com/organization/acme/1'],
      developmentRefs: [{ repo: 'acme/api', number: 7 }],
      connectorPullRequests: false
    })
    expect(
      planZotzRelayReload([notice({ kind: 'pull_request', repo: 'acme/web', number: 12 })], board)
    ).toEqual({
      full: false,
      sourceKeys: ['github.com/repo/acme/web'],
      developmentRefs: [
        { repo: 'acme/web', number: 3 },
        { repo: 'acme/web', number: 4 }
      ],
      connectorPullRequests: true
    })
  })

  it('on a push, only rereads Development and services matching for that repo', () => {
    expect(
      planZotzRelayReload([notice({ kind: 'push', action: 'pushed', repo: 'acme/web' })], board)
    ).toEqual({
      full: false,
      sourceKeys: [],
      developmentRefs: [
        { repo: 'acme/web', number: 3 },
        { repo: 'acme/web', number: 4 }
      ],
      connectorPullRequests: true
    })
  })

  it('on a Project item, rereads only that Project', () => {
    expect(
      planZotzRelayReload(
        [
          notice({
            kind: 'projects_v2_item',
            projectNodeId: 'PVT_hugo2',
            projectItemNodeId: 'PVTI_1'
          })
        ],
        board
      )
    ).toEqual({
      full: false,
      sourceKeys: ['github.com/user/hugo/2'],
      developmentRefs: [],
      connectorPullRequests: false
    })
  })

  it('ignores repos off the board and provider pushes; an installation reloads everything', () => {
    expect(
      planZotzRelayReload(
        [
          notice({ kind: 'issues', repo: 'other/repo', number: 1 }),
          notice({ kind: 'push', repo: 'other/repo' }),
          notice({ kind: 'source_push', sourceId: 'acme-helpdesk', documentId: 'd1' })
        ],
        board
      )
    ).toEqual({ full: false, sourceKeys: [], developmentRefs: [], connectorPullRequests: false })
    expect(
      planZotzRelayReload(
        [notice({ kind: 'issues', repo: 'acme/web', number: 3 }), notice({ kind: 'installation' })],
        board
      ).full
    ).toBe(true)
  })
})
