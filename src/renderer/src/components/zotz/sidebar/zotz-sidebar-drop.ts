import type { ExecutionHostId } from '../../../../../shared/execution-host'

/** What the sidebar can drag: a conversation (with where it lives now) or a group header. */
export type ZotzDragItem =
  | {
      kind: 'conversation'
      member: { hostId: ExecutionHostId; path: string }
      /** Project identity key of its repo; a conversation never leaves its project. */
      projectKey: string
      groupId: string | null
      /** Its place in that group's list. */
      index: number
      /** Conversations hanging under it, which move with it. */
      followers?: { hostId: ExecutionHostId; path: string }[]
    }
  | { kind: 'group'; groupId: string; index: number }

/** Where the pointer is: a place in a group's list, a project, or a place among the groups. */
export type ZotzDropTarget =
  | { kind: 'group'; groupId: string; index: number }
  | { kind: 'project'; projectKey: string }
  | { kind: 'group-order'; index: number }

export type ZotzDropAction =
  | { kind: 'move-to-group'; groupId: string; index: number }
  | { kind: 'remove-from-group' }
  | { kind: 'reorder-group'; groupId: string; index: number }
  | { kind: 'none'; reason: 'other-project' | 'no-change' }

/** A drop index counts the dragged entry; the move takes it out first, so later slots shift by one. */
function insertIndex(from: number | null, to: number): number {
  return from !== null && from < to ? to - 1 : to
}

/** What dropping `item` on `target` does; the sidebar shows it while hovering and applies it on drop. */
export function resolveZotzDrop(item: ZotzDragItem, target: ZotzDropTarget): ZotzDropAction {
  if (item.kind === 'group') {
    return target.kind === 'group-order'
      ? {
          kind: 'reorder-group',
          groupId: item.groupId,
          index: insertIndex(item.index, target.index)
        }
      : { kind: 'none', reason: 'no-change' }
  }
  switch (target.kind) {
    case 'group': {
      const from = item.groupId === target.groupId ? item.index : null
      const index = insertIndex(from, target.index)
      return from === index
        ? { kind: 'none', reason: 'no-change' }
        : { kind: 'move-to-group', groupId: target.groupId, index }
    }
    case 'project':
      if (target.projectKey !== item.projectKey) {
        return { kind: 'none', reason: 'other-project' }
      }
      return item.groupId ? { kind: 'remove-from-group' } : { kind: 'none', reason: 'no-change' }
    case 'group-order':
      return { kind: 'none', reason: 'no-change' }
  }
}
