import type React from 'react'
import { useRef, useState } from 'react'
import {
  resolveZotzDrop,
  type ZotzDragItem,
  type ZotzDropAction,
  type ZotzDropTarget
} from './zotz-sidebar-drop'

// Its own type, so file drops and other apps' drags never look like a sidebar move.
const ZOTZ_DRAG_MIME = 'application/x-zotz-sidebar-item'

type DragHandlers = Pick<
  React.HTMLAttributes<HTMLElement>,
  'draggable' | 'onDragStart' | 'onDragEnd'
> & { draggable: boolean }
type DropHandlers = Pick<React.HTMLAttributes<HTMLElement>, 'onDragOver' | 'onDrop'>

export type ZotzSidebarDrag = {
  item: ZotzDragItem | null
  target: ZotzDropTarget | null
  /** What a drop here would do, for the indicators. */
  action: ZotzDropAction | null
  source: (item: ZotzDragItem) => DragHandlers
  /** `resolve` maps the pointer to a target for the dragged item; null lets the event bubble. */
  zone: (
    resolve: (event: React.DragEvent<HTMLElement>, item: ZotzDragItem) => ZotzDropTarget | null
  ) => DropHandlers
}

function sameTarget(a: ZotzDropTarget | null, b: ZotzDropTarget | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Upper half of the hovered element means "before it". */
export function isBeforeMiddle(event: React.DragEvent<HTMLElement>): boolean {
  const rect = event.currentTarget.getBoundingClientRect()
  return event.clientY < rect.top + rect.height / 2
}

/** Native drag and drop for sidebar rows and group headers; `apply` runs the chosen move. */
export function useZotzSidebarDrag(
  apply: (item: ZotzDragItem, action: ZotzDropAction) => void
): ZotzSidebarDrag {
  const [item, setItem] = useState<ZotzDragItem | null>(null)
  const [target, setTarget] = useState<ZotzDropTarget | null>(null)
  // dragover fires many times a second; the ref avoids a render when the target did not change.
  const targetRef = useRef<ZotzDropTarget | null>(null)
  const clear = (): void => {
    targetRef.current = null
    setItem(null)
    setTarget(null)
  }
  return {
    item,
    target,
    action: item && target ? resolveZotzDrop(item, target) : null,
    source: (dragItem) => ({
      draggable: true,
      onDragStart: (event) => {
        event.stopPropagation()
        event.dataTransfer.setData(ZOTZ_DRAG_MIME, dragItem.kind)
        event.dataTransfer.effectAllowed = 'move'
        setItem(dragItem)
      },
      onDragEnd: clear
    }),
    zone: (resolve) => ({
      onDragOver: (event) => {
        if (!item || !event.dataTransfer.types.includes(ZOTZ_DRAG_MIME)) {
          return
        }
        const next = resolve(event, item)
        if (!next) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect =
          resolveZotzDrop(item, next).kind === 'none' ? 'none' : 'move'
        if (!sameTarget(targetRef.current, next)) {
          targetRef.current = next
          setTarget(next)
        }
      },
      onDrop: (event) => {
        if (!item || !event.dataTransfer.types.includes(ZOTZ_DRAG_MIME)) {
          return
        }
        const next = resolve(event, item)
        if (!next) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        const action = resolveZotzDrop(item, next)
        clear()
        if (action.kind !== 'none') {
          apply(item, action)
        }
      }
    })
  }
}
