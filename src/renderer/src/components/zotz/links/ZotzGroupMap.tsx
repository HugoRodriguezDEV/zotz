import React, { useEffect, useId, useRef } from 'react'
import { agentStateLabel } from '@/components/AgentStateDot'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import type { ZotzGroupMapEdge, ZotzGroupMapMail } from './zotz-group-map-edges'
import { ZOTZ_MAP_HIT, zotzGroupStageHeight } from './zotz-group-map-layout'
import { createZotzGroupMapStage, type ZotzGroupMapStage } from './zotz-group-map-stage'
import type {
  ZotzGroupMapNode,
  ZotzGroupMapPositions,
  ZotzGroupMapStageCallbacks
} from './zotz-group-map-types'

export type { ZotzGroupMapNode } from './zotz-group-map-types'

const NUDGE_PX = 8

/**
 * The group as a room of pixel robots: each member in its conversation's color and state, a dotted
 * line per pair that has written to each other, and an envelope that flies when new mail lands.
 * Robots can be dragged (or moved with the arrow keys); clicking one filters the messages to it.
 */
export function ZotzGroupMap({
  nodes,
  edges,
  parentEdges,
  mail,
  positions,
  onPositionsChange,
  selected,
  onSelect
}: {
  nodes: readonly ZotzGroupMapNode[]
  edges: readonly ZotzGroupMapEdge[]
  parentEdges: readonly { child: number; parent: number }[]
  /** Mail that just arrived, with who wrote to whom. */
  mail: readonly ZotzGroupMapMail[]
  positions?: ZotzGroupMapPositions
  onPositionsChange?: (positions: Record<string, [number, number]>) => void
  /** Key of the member whose messages are shown. */
  selected: string | null
  onSelect: (key: string | null) => void
}): React.JSX.Element {
  const t = useTranslate()
  const reduced = usePrefersReducedMotion()
  const helpId = useId()
  const height = zotzGroupStageHeight(nodes.length)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<ZotzGroupMapStage | null>(null)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const mailAtMount = useRef(mail)
  const callbacks = useRef<ZotzGroupMapStageCallbacks>({
    onSelect,
    onPositionsChange: () => {},
    place: () => {}
  })

  useEffect(() => {
    callbacks.current = {
      onSelect,
      onPositionsChange: onPositionsChange ?? (() => {}),
      place: (key, x, y) => {
        const button = buttons.current.get(key)
        if (button) {
          button.style.transform = `translate(${x - ZOTZ_MAP_HIT.halfWidth}px, ${y - ZOTZ_MAP_HIT.above}px)`
        }
      }
    }
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) {
      return undefined
    }
    const stage = createZotzGroupMapStage(canvas, () => callbacks.current)
    stage.skip(mailAtMount.current)
    stageRef.current = stage
    const size = new ResizeObserver(([entry]) => {
      if (entry) {
        stage.resize(entry.contentRect.width)
      }
    })
    size.observe(wrap)
    // Animate only while on screen.
    const visibility = new IntersectionObserver(([entry]) =>
      stage.setVisible(entry?.isIntersecting ?? false)
    )
    visibility.observe(canvas)
    return () => {
      size.disconnect()
      visibility.disconnect()
      stage.destroy()
      stageRef.current = null
    }
  }, [])

  useEffect(() => {
    stageRef.current?.update({ nodes, edges, parentEdges, selected, positions, reduced, height })
  }, [nodes, edges, parentEdges, selected, positions, reduced, height])

  useEffect(() => {
    stageRef.current?.receive(mail)
  }, [mail])

  const onKeyDown = (key: string, event: React.KeyboardEvent<HTMLButtonElement>): void => {
    const step = event.shiftKey ? NUDGE_PX * 3 : NUDGE_PX
    const move = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step]
    }[event.key]
    if (move) {
      event.preventDefault()
      stageRef.current?.nudge(key, move[0], move[1])
    } else if (event.key === 'Escape' && selected !== null) {
      event.preventDefault()
      onSelect(null)
    }
  }

  const nameOf = (index: number): string => nodes[index]?.label ?? ''
  return (
    <div
      ref={wrapRef}
      role="group"
      aria-label={t('zotz.groups.mapLabel', 'Who in the group writes to whom')}
      className="relative overflow-hidden rounded-md border border-border"
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 block size-full touch-none"
        onPointerDown={(event) => stageRef.current?.pointerDown(event)}
        onPointerMove={(event) => stageRef.current?.pointerMove(event)}
        onPointerUp={() => stageRef.current?.pointerUp()}
        onPointerCancel={() => stageRef.current?.pointerUp()}
      />
      {nodes.map((node) => {
        const state = agentStateLabel(node.state ?? 'idle')
        return (
          <button
            key={node.key}
            ref={(button) => {
              if (button) {
                buttons.current.set(node.key, button)
              } else {
                buttons.current.delete(node.key)
              }
            }}
            type="button"
            aria-pressed={selected === node.key}
            aria-describedby={helpId}
            aria-label={
              node.machine
                ? t('zotz.groups.mapAgentRemote', '{{name}} on {{machine}}: {{state}}', {
                    name: node.label,
                    machine: node.machine,
                    state
                  })
                : t('zotz.groups.mapAgent', '{{name}}: {{state}}', { name: node.label, state })
            }
            // The canvas takes the pointer; this stays for keyboard focus and screen readers.
            className={cn(
              'pointer-events-none absolute top-0 left-0 rounded-md outline-none',
              'focus-visible:ring-2 focus-visible:ring-ring'
            )}
            style={{
              width: ZOTZ_MAP_HIT.halfWidth * 2,
              height: ZOTZ_MAP_HIT.above + ZOTZ_MAP_HIT.below
            }}
            onClick={() => onSelect(selected === node.key ? null : node.key)}
            onKeyDown={(event) => onKeyDown(node.key, event)}
          />
        )
      })}
      <div id={helpId} className="sr-only">
        {t(
          'zotz.groups.mapHelp',
          'Arrow keys move it; Enter shows only its messages. Lines: {{lines}}.',
          {
            lines:
              edges
                .map((edge) =>
                  t('zotz.groups.mapEdge', '{{a}} ↔ {{b}}: {{count}} messages', {
                    a: nameOf(edge.a),
                    b: nameOf(edge.b),
                    count: edge.count
                  })
                )
                .join('; ') || '—'
          }
        )}
      </div>
    </div>
  )
}
