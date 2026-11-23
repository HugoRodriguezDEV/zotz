import React from 'react'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import type { ZotzConversationState } from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import { zotzEdgeKey, type ZotzGroupMapEdge } from './zotz-group-map-edges'

export type ZotzGroupMapNode = {
  key: string
  label: string
  /** Project or machine under the name. */
  detail: string
  state: ZotzConversationState | null
  /** The conversation open in this window. */
  current: boolean
}

const WIDTH = 260
const NODE_RADIUS = 14

function layout(count: number): { points: { x: number; y: number }[]; height: number } {
  if (count <= 1) {
    return { points: [{ x: WIDTH / 2, y: 44 }], height: 96 }
  }
  if (count === 2) {
    return {
      points: [
        { x: 56, y: 44 },
        { x: WIDTH - 56, y: 44 }
      ],
      height: 96
    }
  }
  const radius = count <= 4 ? 62 : 80
  const height = radius * 2 + 80
  const center = { x: WIDTH / 2, y: radius + 26 }
  const points = Array.from({ length: count }, (_, index) => {
    // First member on top, then clockwise.
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }
  })
  return { points, height }
}

function shortLabel(text: string): string {
  return text.length > 14 ? `${text.slice(0, 13)}…` : text
}

/**
 * The group as a map: a node per conversation, a line per pair that has written to each other
 * (thicker with more mail, pulsing when mail just arrived), dashed lines from a child to its parent.
 */
export function ZotzGroupMap({
  nodes,
  edges,
  parentEdges,
  activeEdges,
  selected,
  onSelect
}: {
  nodes: readonly ZotzGroupMapNode[]
  edges: readonly ZotzGroupMapEdge[]
  parentEdges: readonly { child: number; parent: number }[]
  /** Pairs (`zotzEdgeKey`) with mail that just arrived. */
  activeEdges: ReadonlySet<string>
  selected: { a: number; b: number } | null
  onSelect: (pair: { a: number; b: number } | null) => void
}): React.JSX.Element {
  const t = useTranslate()
  const { points, height } = layout(nodes.length)
  const most = Math.max(1, ...edges.map((edge) => edge.count))
  const selectedKey = selected ? zotzEdgeKey(selected.a, selected.b) : null
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      className="w-full"
      role="img"
      aria-label={t('zotz.groups.mapLabel', 'Who in the group writes to whom')}
    >
      <g className="text-muted-foreground">
        {parentEdges.map(({ child, parent }) => (
          <line
            key={`p${child}-${parent}`}
            x1={points[child].x}
            y1={points[child].y}
            x2={points[parent].x}
            y2={points[parent].y}
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        ))}
      </g>
      {edges.map((edge) => {
        const key = zotzEdgeKey(edge.a, edge.b)
        const from = points[edge.a]
        const to = points[edge.b]
        const highlighted = activeEdges.has(key) || selectedKey === key
        return (
          <g
            key={key}
            className={cn(
              'cursor-pointer',
              highlighted ? 'text-primary' : 'text-foreground/40 hover:text-foreground/70',
              activeEdges.has(key) && 'animate-pulse'
            )}
            onClick={() => onSelect(selectedKey === key ? null : { a: edge.a, b: edge.b })}
          >
            <title>
              {t('zotz.groups.mapEdge', '{{a}} ↔ {{b}}: {{count}} messages', {
                a: nodes[edge.a].label,
                b: nodes[edge.b].label,
                count: edge.count
              })}
            </title>
            {/* Wide invisible hit area so a thin line is still easy to click. */}
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="transparent"
              strokeWidth={12}
            />
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="currentColor"
              strokeWidth={1 + (3 * edge.count) / most}
              strokeLinecap="round"
            />
            <text
              x={(from.x + to.x) / 2}
              y={(from.y + to.y) / 2 - 4}
              textAnchor="middle"
              fontSize={9}
              fill="currentColor"
            >
              {edge.count}
            </text>
          </g>
        )
      })}
      {nodes.map((node, index) => {
        const point = points[index]
        return (
          <g key={node.key}>
            <circle
              cx={point.x}
              cy={point.y}
              r={NODE_RADIUS}
              className={cn(
                'fill-card',
                node.state === 'working' ? 'stroke-primary' : 'stroke-border',
                node.state === 'working' && 'animate-pulse'
              )}
              strokeWidth={node.current ? 2.5 : 1.5}
            />
            <text
              x={point.x}
              y={point.y + 3.5}
              textAnchor="middle"
              fontSize={10}
              fontWeight={600}
              className="fill-foreground"
            >
              {node.label.slice(0, 2).toUpperCase()}
            </text>
            <text
              x={point.x}
              y={point.y + NODE_RADIUS + 12}
              textAnchor="middle"
              fontSize={10}
              fontWeight={node.current ? 600 : 500}
              className="fill-foreground"
            >
              {shortLabel(node.label)}
            </text>
            <text
              x={point.x}
              y={point.y + NODE_RADIUS + 23}
              textAnchor="middle"
              fontSize={8.5}
              className="fill-muted-foreground"
            >
              {shortLabel(node.detail)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
