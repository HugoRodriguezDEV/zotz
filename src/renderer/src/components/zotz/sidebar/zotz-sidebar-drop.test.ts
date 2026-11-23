import { describe, expect, it } from 'vitest'
import { resolveZotzDrop, type ZotzDragItem } from './zotz-sidebar-drop'

const conversation = (groupId: string | null, index = 0): ZotzDragItem => ({
  kind: 'conversation',
  member: { hostId: 'local', path: '/a' },
  projectKey: 'panel',
  groupId,
  index
})

describe('resolveZotzDrop', () => {
  it('moves a conversation into a group at the slot under the pointer', () => {
    expect(resolveZotzDrop(conversation(null), { kind: 'group', groupId: 'g', index: 2 })).toEqual({
      kind: 'move-to-group',
      groupId: 'g',
      index: 2
    })
  })

  it('counts the dragged row when reordering inside its own group', () => {
    expect(
      resolveZotzDrop(conversation('g', 0), { kind: 'group', groupId: 'g', index: 3 })
    ).toEqual({ kind: 'move-to-group', groupId: 'g', index: 2 })
    expect(
      resolveZotzDrop(conversation('g', 1), { kind: 'group', groupId: 'g', index: 2 })
    ).toEqual({ kind: 'none', reason: 'no-change' })
  })

  it('takes a conversation out of its group only when dropped on its own project', () => {
    expect(resolveZotzDrop(conversation('g'), { kind: 'project', projectKey: 'panel' })).toEqual({
      kind: 'remove-from-group'
    })
    expect(resolveZotzDrop(conversation('g'), { kind: 'project', projectKey: 'backend' })).toEqual({
      kind: 'none',
      reason: 'other-project'
    })
  })

  it('reorders a group among the groups', () => {
    expect(
      resolveZotzDrop({ kind: 'group', groupId: 'g', index: 0 }, { kind: 'group-order', index: 2 })
    ).toEqual({ kind: 'reorder-group', groupId: 'g', index: 1 })
  })
})
