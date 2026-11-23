import React from 'react'
import { cn } from '@/lib/class-names'
import { sameZotzLinkMember } from '../links/zotz-link-groups'
import { isBeforeMiddle, type ZotzSidebarDrag } from './use-zotz-sidebar-drag'
import type { ZotzDragItem } from './zotz-sidebar-drop'

export function ZotzDropLine({ show }: { show: boolean }): React.JSX.Element | null {
  return show ? <div aria-hidden className="mx-2 my-0.5 h-0.5 rounded-full bg-primary" /> : null
}

/** A conversation row the user can drag; in a group it also takes drops before or after itself. */
export function ZotzDraggableRow({
  drag,
  item,
  dropAt,
  children
}: {
  drag: ZotzSidebarDrag
  item: ZotzDragItem
  /** Member index of this row in its group; absent in a project, whose section takes the drop. */
  dropAt?: { groupId: string; index: number }
  children: React.ReactNode
}): React.JSX.Element {
  const zone = dropAt
    ? drag.zone((event, dragged) =>
        dragged.kind === 'conversation'
          ? {
              kind: 'group',
              groupId: dropAt.groupId,
              index: isBeforeMiddle(event) ? dropAt.index : dropAt.index + 1
            }
          : null
      )
    : {}
  const target = drag.target
  const lineAt =
    dropAt && target?.kind === 'group' && target.groupId === dropAt.groupId ? target.index : null
  const dragging =
    drag.item?.kind === 'conversation' &&
    item.kind === 'conversation' &&
    sameZotzLinkMember(drag.item.member, item.member)
  return (
    <div {...drag.source(item)} {...zone} className={cn(dragging && 'opacity-50')}>
      <ZotzDropLine show={dropAt !== undefined && lineAt === dropAt.index} />
      {children}
    </div>
  )
}
