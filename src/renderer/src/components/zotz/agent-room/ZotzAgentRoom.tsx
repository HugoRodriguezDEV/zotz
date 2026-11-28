import React, { useEffect, useId, useRef, useState } from 'react'
import { CornerDownRight, Crown, Link2 } from 'lucide-react'
import { agentStateLabel } from '@/components/AgentStateDot'
import { AgentTypeIcon } from '@/components/agent/icons/agent-type-icon'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { useZotzAgentRoomPositions } from './use-zotz-agent-room-positions'
import { ZOTZ_ROOM_HIT, zotzRoomColumns, zotzRoomHeight } from './zotz-agent-room-layout'
import { ZOTZ_ROOM_TAG_MARK } from './zotz-agent-room-paint'
import { createZotzAgentRoomStage, type ZotzAgentRoomStage } from './zotz-agent-room-stage'
import {
  zotzRoomAgentMarked,
  type ZotzAgentRoomStageCallbacks,
  type ZotzRoomAgent,
  type ZotzRoomGuide,
  type ZotzRoomLink,
  type ZotzRoomMail
} from './zotz-agent-room-types'

export type {
  ZotzRoomAgent,
  ZotzRoomGuide,
  ZotzRoomLink,
  ZotzRoomMail
} from './zotz-agent-room-types'

export type ZotzAgentRoomProps = {
  agents: readonly ZotzRoomAgent[]
  /** Accessible name of the room. */
  label: string
  /** Saves where each robot stands under this key (settings `zotzAgentRoomPositions`); omit to not save. */
  roomKey?: string | null
  /** Who has written to whom, by agent key. */
  links?: readonly ZotzRoomLink[]
  /** Mail that just arrived; each new id flies once. Pass a new array per batch. */
  mail?: readonly ZotzRoomMail[]
  /** Faint dashed child → parent lines, drawn even when the two never wrote. */
  guides?: readonly ZotzRoomGuide[]
  /** Key of the highlighted agent; lines and names away from it fade. */
  selected?: string | null
  /** Click (without dragging) on a robot, or Space (Enter too without `onOpen`); null when it is clicked again or the floor is. */
  onSelect?: (key: string | null) => void
  /** Double click or Enter on a robot. */
  onOpen?: (key: string) => void
}

const NONE: readonly never[] = []
const NUDGE_PX = 8

/**
 * A room of full-body pixel robots, one per agent, in its conversation's color and state with its
 * model's logo on the name tag. Dotted lines join agents who wrote to each other and an envelope
 * flies when new mail lands. Robots are dragged with the pointer or the arrow keys.
 */
export function ZotzAgentRoom({
  agents,
  label,
  roomKey = null,
  links = NONE,
  mail = NONE,
  guides = NONE,
  selected = null,
  onSelect,
  onOpen
}: ZotzAgentRoomProps): React.JSX.Element {
  const t = useTranslate()
  const reduced = usePrefersReducedMotion()
  const helpId = useId()
  const [positions, savePositions] = useZotzAgentRoomPositions(roomKey)
  const [width, setWidth] = useState(0)
  const columns = zotzRoomColumns(agents.length, width)
  const height = zotzRoomHeight(agents.length, columns)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<ZotzAgentRoomStage | null>(null)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const logos = useRef(new Map<string, HTMLSpanElement>())
  const groupMarks = useRef(new Map<string, HTMLSpanElement>())
  const mailAtMount = useRef(mail)
  const select = (key: string | null): void => onSelect?.(key)
  const open = (key: string): void => onOpen?.(key)
  const callbacks = useRef<ZotzAgentRoomStageCallbacks>({
    onSelect: select,
    onOpen: open,
    onPositionsChange: savePositions,
    place: () => {}
  })

  useEffect(() => {
    callbacks.current = {
      onSelect: select,
      onOpen: open,
      onPositionsChange: savePositions,
      place: (key, x, y, tag) => {
        const button = buttons.current.get(key)
        if (button) {
          button.style.transform = `translate(${x - ZOTZ_ROOM_HIT.halfWidth}px, ${y - ZOTZ_ROOM_HIT.above}px)`
        }
        const top = y + 7 + ZOTZ_ROOM_TAG_MARK.top
        const logo = logos.current.get(key)
        if (logo) {
          logo.style.transform = `translate(${tag.left + ZOTZ_ROOM_TAG_MARK.inset}px, ${top}px)`
        }
        const mark = groupMarks.current.get(key)
        if (mark) {
          const left = tag.left + tag.width - ZOTZ_ROOM_TAG_MARK.inset - ZOTZ_ROOM_TAG_MARK.size
          mark.style.transform = `translate(${left}px, ${top}px)`
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
    const stage = createZotzAgentRoomStage(canvas, () => callbacks.current)
    stage.skip(mailAtMount.current)
    stageRef.current = stage
    const size = new ResizeObserver(([entry]) => {
      if (entry) {
        setWidth(Math.round(entry.contentRect.width))
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
    stageRef.current?.update({
      agents,
      links,
      guides,
      selected,
      positions,
      reduced,
      height,
      columns: width > 0 ? columns : 0
    })
  }, [agents, links, guides, selected, positions, reduced, height, columns, width])

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
    } else if (event.key === 'Enter' && onOpen) {
      event.preventDefault()
      onOpen(key)
    } else if (event.key === 'Escape' && selected !== null) {
      event.preventDefault()
      select(null)
    }
  }

  const nameOf = (key: string): string => agents.find((agent) => agent.key === key)?.label ?? key
  const lines =
    [
      ...links.map((link) =>
        t('zotz.agentRoom.line', '{{a}} ↔ {{b}}: {{count}} messages', {
          a: nameOf(link.a),
          b: nameOf(link.b),
          count: link.count
        })
      ),
      ...guides.map((guide) =>
        t('zotz.agentRoom.guide', '{{child}} is a worker of {{parent}}', {
          child: nameOf(guide.child),
          parent: nameOf(guide.parent)
        })
      )
    ].join('; ') || '—'
  const faded = (key: string): string | false =>
    selected !== null && selected !== key && 'opacity-50'
  return (
    <div
      ref={wrapRef}
      role="group"
      aria-label={label}
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
      {agents.map((agent) =>
        agent.agent ? (
          <span
            key={`logo:${agent.key}`}
            ref={(element) => {
              if (element) {
                logos.current.set(agent.key, element)
              } else {
                logos.current.delete(agent.key)
              }
            }}
            aria-hidden
            className={cn('pointer-events-none absolute top-0 left-0 flex', faded(agent.key))}
          >
            <AgentTypeIcon agentType={agent.agent} size={ZOTZ_ROOM_TAG_MARK.size} />
          </span>
        ) : null
      )}
      {agents.map((agent) =>
        zotzRoomAgentMarked(agent) ? (
          <span
            key={`group:${agent.key}`}
            ref={(element) => {
              if (element) {
                groupMarks.current.set(agent.key, element)
              } else {
                groupMarks.current.delete(agent.key)
              }
            }}
            aria-hidden
            className={cn(
              'pointer-events-none absolute top-0 left-0 flex text-muted-foreground',
              faded(agent.key)
            )}
          >
            {agent.inGroup ? (
              <Link2 size={ZOTZ_ROOM_TAG_MARK.size} />
            ) : agent.kin === 'parent' ? (
              <Crown size={ZOTZ_ROOM_TAG_MARK.size} />
            ) : (
              <CornerDownRight size={ZOTZ_ROOM_TAG_MARK.size} />
            )}
          </span>
        ) : null
      )}
      {agents.map((agent) => {
        const state = agentStateLabel(agent.state ?? 'idle')
        const values = { name: agent.label, machine: agent.machine, state }
        const name = agent.machine
          ? t('zotz.agentRoom.agentRemote', '{{name}} on {{machine}}: {{state}}', values)
          : t('zotz.agentRoom.agent', '{{name}}: {{state}}', values)
        return (
          <button
            key={agent.key}
            ref={(element) => {
              if (element) {
                buttons.current.set(agent.key, element)
              } else {
                buttons.current.delete(agent.key)
              }
            }}
            type="button"
            aria-pressed={selected === agent.key}
            aria-describedby={helpId}
            aria-label={
              agent.inGroup
                ? `${name}, ${t('zotz.agentRoom.inGroup', 'in a group')}`
                : agent.kin === 'parent'
                  ? `${name}, ${t('zotz.agentRoom.kinParent', 'parent of a member')}`
                  : agent.kin === 'worker'
                    ? `${name}, ${t('zotz.agentRoom.kinWorker', 'worker of a member')}`
                    : name
            }
            // The canvas takes the pointer; this stays for keyboard focus and screen readers.
            className={cn(
              'pointer-events-none absolute top-0 left-0 rounded-md outline-none',
              'focus-visible:ring-2 focus-visible:ring-ring'
            )}
            style={{
              width: ZOTZ_ROOM_HIT.halfWidth * 2,
              height: ZOTZ_ROOM_HIT.above + ZOTZ_ROOM_HIT.below
            }}
            onClick={() => select(selected === agent.key ? null : agent.key)}
            onKeyDown={(event) => onKeyDown(agent.key, event)}
          />
        )
      })}
      <div id={helpId} className="sr-only">
        {onOpen
          ? t(
              'zotz.agentRoom.helpOpen',
              'Arrow keys move it; Space selects it; Enter opens it. Lines: {{lines}}.',
              { lines }
            )
          : t('zotz.agentRoom.help', 'Arrow keys move it; Enter selects it. Lines: {{lines}}.', {
              lines
            })}
      </div>
    </div>
  )
}
