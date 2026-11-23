import { describe, expect, it } from 'vitest'
import type { Worktree } from '../../../../../shared/worktree/types'
import { nestZotzChildren, type ZotzConversationRow } from './zotz-project-conversations'

function row(id: string, parent?: string): ZotzConversationRow {
  const worktree = {
    id,
    cliProvenance: parent
      ? { kind: 'created-by-cli', createdAt: 1, zotzParentWorktreeId: parent }
      : undefined
  } as Worktree
  return {
    id,
    title: id,
    branch: null,
    shortName: null,
    lastActivityAt: 0,
    worktree,
    repo: null,
    hostId: 'local'
  }
}

const ids = (lists: ZotzConversationRow[][]) => lists.map((list) => list.map((r) => r.id))

describe('nestZotzChildren', () => {
  it('hangs a child under its parent in the same group, and across projects when ungrouped', () => {
    const result = nestZotzChildren(
      [[row('panel'), row('backend', 'panel')]],
      [[row('tautog')], [row('marca', 'tautog')]]
    )
    expect(ids(result.groupLists)).toEqual([['panel']])
    expect(ids(result.projectLists)).toEqual([['tautog'], []])
    expect(result.childrenOf.get('local\npanel')?.map((r) => r.id)).toEqual(['backend'])
    expect(result.childrenOf.get('local\ntautog')?.map((r) => r.id)).toEqual(['marca'])
  })

  it('keeps a child moved to another group where it was put', () => {
    const result = nestZotzChildren([[row('panel')], [row('backend', 'panel')]], [])
    expect(ids(result.groupLists)).toEqual([['panel'], ['backend']])
  })
})
