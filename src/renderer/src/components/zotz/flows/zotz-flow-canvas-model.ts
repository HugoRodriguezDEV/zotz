import type { Edge, Node } from '@xyflow/react'
import type { ZotzFlowDraft } from '../../../../../shared/zotz/flows/zotz-flow-contract'
import type { ZotzFlowNode } from '../../../../../shared/zotz/flows/zotz-flow-node-contract'
import type { ZotzFlowNodeRunStatus } from '../../../../../shared/zotz/flows/zotz-flow-run-contract'
import type { ZotzFlowTrigger } from '../../../../../shared/zotz/flows/zotz-flow-trigger-contract'
import {
  indexZotzFlowNodes,
  zotzFlowNodeSize,
  zotzFlowParentChain,
  ZOTZ_FLOW_NODE_SIZE
} from './zotz-flow-canvas-geometry'
import type { ZotzFlowProblemMarks } from './zotz-flow-problems-view'
import type { ZotzFlowSelection } from './use-zotz-flow-editor-state'

export const ZOTZ_FLOW_TRIGGERS_NODE_ID = '__zotz_flow_triggers'
export const ZOTZ_FLOW_INPUT_HANDLE = 'in'

export type ZotzFlowNodeRunView = {
  status: ZotzFlowNodeRunStatus
  /** Loop progress, e.g. `7/10 · 1 failed`. */
  progress?: string
}

export type ZotzFlowLoopPicker = {
  total: number
  selected: number
  failed: ReadonlySet<number>
  onSelect: (index: number) => void
}

export type ZotzFlowStepData = {
  node: ZotzFlowNode
  mark?: 'error' | 'warning'
  run?: ZotzFlowNodeRunView | null
  loopPicker?: ZotzFlowLoopPicker
}

export type ZotzFlowTriggersData = {
  triggers: ZotzFlowTrigger[]
  marks: ReadonlyMap<string, 'error' | 'warning'>
  selectedTriggerId: string | null
  onSelectTrigger: (triggerId: string) => void
}

export type ZotzFlowCanvasDecor = {
  marks?: ZotzFlowProblemMarks
  run?: (nodeId: string) => ZotzFlowNodeRunView | null
  loopPicker?: (nodeId: string) => ZotzFlowLoopPicker | undefined
  measured: Readonly<Record<string, { width: number; height: number }>>
  editable: boolean
}

type Graph = Pick<ZotzFlowDraft, 'nodes' | 'edges' | 'triggers'>

function triggersPosition(nodes: readonly ZotzFlowNode[]): { x: number; y: number } {
  const top = nodes.filter((node) => !node.parentId)
  if (top.length === 0) {
    return { x: 0, y: 0 }
  }
  return {
    x: Math.min(...top.map((node) => node.position.x)) - ZOTZ_FLOW_NODE_SIZE.width - 70,
    y: Math.min(...top.map((node) => node.position.y))
  }
}

export function buildZotzFlowCanvasNodes(
  graph: Graph,
  selection: ZotzFlowSelection,
  decor: ZotzFlowCanvasDecor,
  onSelectTrigger: (triggerId: string) => void
): Node[] {
  const byId = indexZotzFlowNodes(graph.nodes)
  // React Flow needs a parent before its children.
  const ordered = [...graph.nodes].sort(
    (a, b) => zotzFlowParentChain(a, byId).length - zotzFlowParentChain(b, byId).length
  )
  const triggers: Node<ZotzFlowTriggersData> = {
    id: ZOTZ_FLOW_TRIGGERS_NODE_ID,
    type: 'triggers',
    position: triggersPosition(graph.nodes),
    draggable: false,
    deletable: false,
    connectable: false,
    selected: selection?.kind === 'triggers',
    measured: decor.measured[ZOTZ_FLOW_TRIGGERS_NODE_ID],
    data: {
      triggers: graph.triggers,
      marks: decor.marks?.triggers ?? new Map(),
      selectedTriggerId: selection?.kind === 'triggers' ? selection.triggerId : null,
      onSelectTrigger
    }
  }
  const steps = ordered.map((node): Node<ZotzFlowStepData> => {
    const loop = node.kind === 'for_each'
    const size = loop ? zotzFlowNodeSize(node, graph.nodes) : undefined
    return {
      id: node.id,
      type: loop ? 'loop' : 'step',
      position: node.position,
      ...(node.parentId && byId.has(node.parentId) ? { parentId: node.parentId } : {}),
      draggable: decor.editable,
      deletable: decor.editable,
      connectable: decor.editable,
      selected: selection?.kind === 'node' && selection.id === node.id,
      ...(size ? { style: { width: size.width, height: size.height } } : {}),
      measured: size ?? decor.measured[node.id],
      data: {
        node,
        mark: decor.marks?.nodes.get(node.id),
        run: decor.run?.(node.id) ?? null,
        loopPicker: decor.loopPicker?.(node.id)
      }
    }
  })
  return [triggers, ...steps]
}

export function buildZotzFlowCanvasEdges(
  graph: Graph,
  selection: ZotzFlowSelection,
  decor: Pick<ZotzFlowCanvasDecor, 'marks' | 'editable' | 'run'>
): Edge[] {
  const targeted = new Set(graph.edges.map((edge) => edge.to.nodeId))
  const roots = graph.nodes.filter((node) => !node.parentId && !targeted.has(node.id))
  const fromTriggers = roots.map((node): Edge => ({
    id: `${ZOTZ_FLOW_TRIGGERS_NODE_ID}:${node.id}`,
    source: ZOTZ_FLOW_TRIGGERS_NODE_ID,
    target: node.id,
    targetHandle: ZOTZ_FLOW_INPUT_HANDLE,
    selectable: false,
    deletable: false,
    focusable: false,
    className: 'zotz-flow-edge-implicit'
  }))
  const edges = graph.edges.map((edge): Edge => {
    const mark = decor.marks?.edges.get(edge.id)
    const taken = decor.run?.(edge.to.nodeId)
    return {
      id: edge.id,
      source: edge.from.nodeId,
      sourceHandle: edge.from.port,
      target: edge.to.nodeId,
      targetHandle: ZOTZ_FLOW_INPUT_HANDLE,
      selected: selection?.kind === 'edge' && selection.id === edge.id,
      deletable: decor.editable,
      className: mark
        ? `zotz-flow-edge-${mark}`
        : taken && taken.status !== 'pending' && taken.status !== 'skipped'
          ? 'zotz-flow-edge-taken'
          : undefined
    }
  })
  return [...fromTriggers, ...edges]
}
