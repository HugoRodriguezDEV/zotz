import { useMemo } from 'react'
import type { ZotzFlowNodeKind } from '../../../../../shared/zotz/flows/zotz-flow-node-contract'
import type { ZotzFlowCanvasEditing } from './ZotzFlowCanvas'
import type { ZotzFlowEditorState } from './use-zotz-flow-editor-state'
import type { ZotzFlowNodeInspectorActions } from './ZotzFlowNodeInspector'
import {
  addZotzFlowNode,
  connectZotzFlowNodes,
  moveZotzFlowNodes,
  newZotzFlowId,
  removeZotzFlowElements,
  reparentZotzFlowNodeAfterDrag,
  setZotzFlowNodeParent,
  updateZotzFlowNode
} from './zotz-flow-graph-edits'

/** Canvas and inspector edits as history entries; a drag records one entry, not one per frame. */
export function useZotzFlowEditorActions(editor: ZotzFlowEditorState): {
  canvas: ZotzFlowCanvasEditing
  inspector: ZotzFlowNodeInspectorActions
  addKind: (kind: ZotzFlowNodeKind) => void
} {
  const { edit, transient, checkpoint, selection } = editor
  const selectedNodeId = selection?.kind === 'node' ? selection.id : null
  return useMemo(() => {
    const addKind = (kind: ZotzFlowNodeKind): void => {
      const id = newZotzFlowId()
      edit((draft) => addZotzFlowNode(draft, kind, { id, after: selectedNodeId }).draft, {
        kind: 'node',
        id
      })
    }
    const canvas: ZotzFlowCanvasEditing = {
      onMove: (positions, dragging) => {
        const update = (draft: Parameters<typeof moveZotzFlowNodes>[0]) =>
          moveZotzFlowNodes(draft, positions)
        if (dragging) {
          transient(update)
        } else {
          edit(update)
        }
      },
      onDragStart: checkpoint,
      onDragStop: (nodeIds) =>
        transient((draft) =>
          nodeIds.reduce((next, id) => reparentZotzFlowNodeAfterDrag(next, id), draft)
        ),
      onConnect: (fromId, port, toId) =>
        edit((draft) => connectZotzFlowNodes(draft, fromId, port, toId)),
      onDelete: (nodeIds, edgeIds) =>
        edit((draft) => removeZotzFlowElements(draft, nodeIds, edgeIds)),
      onDropKind: (kind, position) => {
        const id = newZotzFlowId()
        edit(
          (draft) =>
            reparentZotzFlowNodeAfterDrag(addZotzFlowNode(draft, kind, { id, position }).draft, id),
          { kind: 'node', id }
        )
      }
    }
    const inspector: ZotzFlowNodeInspectorActions = {
      update: (nodeId, update) => edit((draft) => updateZotzFlowNode(draft, nodeId, update)),
      connect: (fromId, port, toId) =>
        edit((draft) => connectZotzFlowNodes(draft, fromId, port, toId)),
      removeEdge: (edgeId) => edit((draft) => removeZotzFlowElements(draft, [], [edgeId])),
      setParent: (nodeId, parentId) =>
        edit((draft) => setZotzFlowNodeParent(draft, nodeId, parentId)),
      remove: (nodeId) => edit((draft) => removeZotzFlowElements(draft, [nodeId], []), null)
    }
    return { canvas, inspector, addKind }
  }, [edit, transient, checkpoint, selectedNodeId])
}
