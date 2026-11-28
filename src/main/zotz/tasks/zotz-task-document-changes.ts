import type { ZotzTasksDocument } from '../../../shared/zotz/tasks/zotz-tasks-contract'

/** A connector's tasks before and after a sync or a move; `previous` is null on its first load. */
export type ZotzTaskDocumentChange = {
  connectorId: string
  previous: ZotzTasksDocument | null
  next: ZotzTasksDocument
}

// Electron-free hand-off from the connector service to other main-process readers (flows).
const listeners = new Set<(change: ZotzTaskDocumentChange) => void>()

export function onZotzTaskDocumentChanged(
  listener: (change: ZotzTaskDocumentChange) => void
): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function reportZotzTaskDocumentChange(change: ZotzTaskDocumentChange): void {
  for (const listener of listeners) {
    try {
      listener(change)
    } catch (error) {
      console.warn('[zotz-tasks] a document listener failed:', error)
    }
  }
}
