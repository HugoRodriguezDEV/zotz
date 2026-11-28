import React from 'react'
import type { ZotzSidebarDrag } from './use-zotz-sidebar-drag'
import type { ZotzDragItem } from './zotz-sidebar-drop'
import { ZotzDraggableRow } from './ZotzDraggableRow'
import { ZotzFlashSessions } from './ZotzFlashSessions'
import { zotzRowKey, type ZotzConversationRow } from './zotz-project-conversations'

type Member = { hostId: ZotzConversationRow['hostId']; path: string }

/** Every conversation hanging under `row`, depth first: they move with it. */
export function zotzDescendants(
  row: ZotzConversationRow,
  childrenOf: ReadonlyMap<string, readonly ZotzConversationRow[]>
): ZotzConversationRow[] {
  return (childrenOf.get(zotzRowKey(row)) ?? []).flatMap((child) => [
    child,
    ...zotzDescendants(child, childrenOf)
  ])
}

export function zotzRowMember(row: ZotzConversationRow): Member | null {
  return row.worktree ? { hostId: row.hostId, path: row.worktree.path } : null
}

/** A conversation and, indented under it, its running background work and the conversations its agent created. */
export function ZotzConversationTree({
  row,
  childrenOf,
  drag,
  itemFor,
  dropAtFor,
  render
}: {
  row: ZotzConversationRow
  childrenOf: ReadonlyMap<string, readonly ZotzConversationRow[]>
  drag: ZotzSidebarDrag
  /** Null for a row that can't be dragged. */
  itemFor: (row: ZotzConversationRow, followers: Member[]) => ZotzDragItem | null
  dropAtFor: (row: ZotzConversationRow) => { groupId: string; index: number } | undefined
  render: (row: ZotzConversationRow) => React.ReactNode
}): React.JSX.Element {
  const children = childrenOf.get(zotzRowKey(row)) ?? []
  const followers = zotzDescendants(row, childrenOf).flatMap((child) => {
    const member = zotzRowMember(child)
    return member ? [member] : []
  })
  const item = itemFor(row, followers)
  const content = item ? (
    <ZotzDraggableRow drag={drag} item={item} dropAt={dropAtFor(row)}>
      {render(row)}
    </ZotzDraggableRow>
  ) : (
    render(row)
  )
  return (
    <>
      {content}
      <ZotzFlashSessions workspaceId={row.id} hostId={row.hostId} />
      {children.length > 0 ? (
        <div className="ml-5 border-l border-worktree-sidebar-border pl-1">
          {children.map((child) => (
            <ZotzConversationTree
              key={child.id}
              row={child}
              childrenOf={childrenOf}
              drag={drag}
              itemFor={itemFor}
              dropAtFor={dropAtFor}
              render={render}
            />
          ))}
        </div>
      ) : null}
    </>
  )
}
