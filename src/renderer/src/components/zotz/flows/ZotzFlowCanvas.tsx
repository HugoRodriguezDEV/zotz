import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type OnDelete
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './zotz-flow-canvas.css'
import { useTranslate } from '@/i18n/use-translate'
import type { ZotzFlowDraft } from '../../../../../shared/zotz/flows/zotz-flow-contract'
import type { ZotzFlowNodeKind } from '../../../../../shared/zotz/flows/zotz-flow-node-contract'
import {
  buildZotzFlowCanvasEdges,
  buildZotzFlowCanvasNodes,
  ZOTZ_FLOW_TRIGGERS_NODE_ID,
  type ZotzFlowCanvasDecor
} from './zotz-flow-canvas-model'
import { ZOTZ_FLOW_NODE_TYPES } from './ZotzFlowCanvasNodes'
import { ZOTZ_FLOW_PALETTE_KINDS } from './zotz-flow-node-catalog'
import { pickZotzFlowOption } from './zotz-flow-form-values'
import { zotzFlowOpeningViewport } from './zotz-flow-canvas-viewport'
import { ZotzFlowZoomControls } from './ZotzFlowZoomControls'
import type { ZotzFlowSelection } from './use-zotz-flow-editor-state'

export const ZOTZ_FLOW_DRAG_MIME = 'application/x-zotz-flow-node-kind'
// The explicit "fit" control frames everything, even below the readable zoom.
const FIT_ALL = { padding: 0.1, maxZoom: 1 }

export type ZotzFlowCanvasEditing = {
  onMove: (positions: Map<string, { x: number; y: number }>, dragging: boolean) => void
  onDragStart: () => void
  onDragStop: (nodeIds: string[]) => void
  onConnect: (fromId: string, port: string, toId: string) => void
  onDelete: (nodeIds: string[], edgeIds: string[]) => void
  onDropKind: (kind: ZotzFlowNodeKind, position: { x: number; y: number }) => void
}

type Props = {
  graph: Pick<ZotzFlowDraft, 'nodes' | 'edges' | 'triggers'>
  selection: ZotzFlowSelection
  onSelect: (selection: ZotzFlowSelection) => void
  decor: Omit<ZotzFlowCanvasDecor, 'measured' | 'editable'>
  editing?: ZotzFlowCanvasEditing
  ariaLabel: string
  /** Bump to frame the whole graph again, e.g. after tidying it up. */
  fitRequest?: number
}

function CanvasInner({
  fitRequest = 0,
  graph,
  selection,
  onSelect,
  decor,
  editing,
  ariaLabel
}: Props): React.JSX.Element {
  const t = useTranslate()
  const flow = useReactFlow()
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({})
  const editable = editing !== undefined
  const containerRef = useRef<HTMLDivElement>(null)
  const initialized = useNodesInitialized()
  const fittedFor = useRef<number | null>(null)
  // Counts applied framings so following the selection runs after them, not before.
  const [framings, setFramings] = useState(0)
  // Fits once nodes are measured (open, run view) and again whenever `fitRequest` changes.
  useEffect(() => {
    if (!initialized || fittedFor.current === fitRequest) {
      return
    }
    // Next frame: React Flow has adopted the new positions (auto-layout) by then.
    const frame = requestAnimationFrame(() => {
      const box = containerRef.current?.getBoundingClientRect()
      if (!box) {
        return
      }
      fittedFor.current = fitRequest
      void flow
        .setViewport(zotzFlowOpeningViewport(flow.getNodesBounds(flow.getNodes()), box))
        .then(() => setFramings((count) => count + 1))
    })
    return () => cancelAnimationFrame(frame)
  }, [initialized, fitRequest, flow])
  const selectedNodeId = selection?.kind === 'node' ? selection.id : null
  // Keyboard and list selections can land off screen; bring the step into view.
  useEffect(() => {
    const node = selectedNodeId ? flow.getInternalNode(selectedNodeId) : undefined
    const box = containerRef.current?.getBoundingClientRect()
    if (!node || !box || framings === 0) {
      return
    }
    const { x, y, zoom } = flow.getViewport()
    const width = node.measured.width ?? 0
    const height = node.measured.height ?? 0
    const left = node.internals.positionAbsolute.x * zoom + x
    const top = node.internals.positionAbsolute.y * zoom + y
    const visible =
      left >= 0 && top >= 0 && left + width * zoom <= box.width && top + height * zoom <= box.height
    if (!visible) {
      // Instant jump: no motion to tune for reduced-motion users.
      void flow.setCenter(
        node.internals.positionAbsolute.x + width / 2,
        node.internals.positionAbsolute.y + height / 2,
        {
          zoom
        }
      )
    }
  }, [selectedNodeId, flow, framings])
  const onSelectTrigger = useCallback(
    (triggerId: string) => onSelect({ kind: 'triggers', triggerId }),
    [onSelect]
  )
  const nodes = useMemo(
    () =>
      buildZotzFlowCanvasNodes(graph, selection, { ...decor, measured, editable }, onSelectTrigger),
    [graph, selection, decor, measured, editable, onSelectTrigger]
  )
  const edges = useMemo(
    () => buildZotzFlowCanvasEdges(graph, selection, { ...decor, editable }),
    [graph, selection, decor, editable]
  )

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const sizes: Record<string, { width: number; height: number }> = {}
      const positions = new Map<string, { x: number; y: number }>()
      let dragging = false
      for (const change of changes) {
        if (change.type === 'dimensions' && change.dimensions) {
          sizes[change.id] = change.dimensions
        } else if (
          change.type === 'position' &&
          change.position &&
          change.id !== ZOTZ_FLOW_TRIGGERS_NODE_ID
        ) {
          positions.set(change.id, change.position)
          if (change.dragging === true) {
            dragging = true
          }
        } else if (change.type === 'select' && change.selected) {
          onSelect(
            change.id === ZOTZ_FLOW_TRIGGERS_NODE_ID
              ? { kind: 'triggers', triggerId: null }
              : { kind: 'node', id: change.id }
          )
        }
      }
      if (Object.keys(sizes).length > 0) {
        setMeasured((current) => ({ ...current, ...sizes }))
      }
      if (positions.size > 0) {
        editing?.onMove(positions, dragging)
      }
    },
    [editing, onSelect]
  )
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === 'select' && change.selected) {
          onSelect({ kind: 'edge', id: change.id })
        }
      }
    },
    [onSelect]
  )
  const onDelete = useCallback<OnDelete>(
    ({ nodes: removedNodes, edges: removedEdges }) =>
      editing?.onDelete(
        removedNodes.map((node) => node.id).filter((id) => id !== ZOTZ_FLOW_TRIGGERS_NODE_ID),
        removedEdges.map((edge) => edge.id)
      ),
    [editing]
  )
  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source !== ZOTZ_FLOW_TRIGGERS_NODE_ID && connection.sourceHandle) {
        editing?.onConnect(connection.source, connection.sourceHandle, connection.target)
      }
    },
    [editing]
  )
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      const kind = pickZotzFlowOption(
        ZOTZ_FLOW_PALETTE_KINDS,
        event.dataTransfer.getData(ZOTZ_FLOW_DRAG_MIME)
      )
      if (!kind || !editing) {
        return
      }
      event.preventDefault()
      editing.onDropKind(kind, flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }))
    },
    [editing, flow]
  )

  return (
    <div
      ref={containerRef}
      className="zotz-flow-canvas size-full"
      onDragOver={(event) => {
        if (editing && event.dataTransfer.types.includes(ZOTZ_FLOW_DRAG_MIME)) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }
      }}
      onDrop={onDrop}
    >
      <ReactFlow
        aria-label={ariaLabel}
        nodes={nodes}
        edges={edges}
        nodeTypes={ZOTZ_FLOW_NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onDelete={onDelete}
        onConnect={onConnect}
        onNodeDragStart={editing?.onDragStart}
        onNodeDragStop={(_event, _node, dragged) =>
          editing?.onDragStop(dragged.map((node) => node.id))
        }
        onPaneClick={() => onSelect(null)}
        nodesDraggable={editable}
        nodesConnectable={editable}
        edgesReconnectable={false}
        deleteKeyCode={editable ? ['Backspace', 'Delete'] : null}
        multiSelectionKeyCode={null}
        selectionKeyCode={null}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        ariaLabelConfig={{
          'node.a11yDescription.default': t(
            'zotz.flows.a11y.node',
            'Press Enter or Space to select this step. Use the arrow keys to move it and Delete to remove it.'
          ),
          'node.a11yDescription.keyboardDisabled': t(
            'zotz.flows.a11y.nodeReadOnly',
            'Press Enter or Space to see this step.'
          ),
          'edge.a11yDescription.default': t(
            'zotz.flows.a11y.edge',
            'Press Enter or Space to select this connection, then Delete to remove it.'
          )
        }}
      >
        <Background gap={20} size={1.5} />
        <ZotzFlowZoomControls onFitAll={() => void flow.fitView(FIT_ALL)} />
        <MiniMap
          pannable
          zoomable
          style={{ width: 160, height: 100 }}
          nodeColor="var(--muted-foreground)"
          nodeStrokeWidth={0}
          nodeBorderRadius={4}
          ariaLabel={t('zotz.flows.minimap', 'Minimap')}
        />
      </ReactFlow>
    </div>
  )
}

/** One canvas for editing and for watching a run; without `editing` it is read-only. */
export function ZotzFlowCanvas(props: Props): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
