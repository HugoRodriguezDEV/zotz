// The agent room, live on a canvas: where each robot stands, dragging them, envelopes that
// fly when mail arrives, and drawing it all on the shared sprite clock.

import type React from 'react'
import { subscribeZotzSpriteClock } from '../agent-sprite/zotz-agent-sprite-clock'
import { zotzSpriteTheme } from '../agent-sprite/zotz-agent-sprite-theme'
import {
  clampZotzRoomSpot,
  hitZotzRoomAgent,
  settleZotzRoomSpots,
  placeZotzRoomAgents,
  type ZotzRoomSpot
} from './zotz-agent-room-layout'
import { paintZotzAgentRoom, zotzRoomTagLeft, zotzRoomTagWidth } from './zotz-agent-room-paint'
import {
  buildZotzRoomScene,
  deliverZotzRoomMail,
  GROW_MS,
  MAIL_BUBBLE_MS,
  NEVER,
  scheduleZotzRoomMail,
  type EdgeAnim,
  type Packet
} from './zotz-agent-room-scene'
import { zotzAgentRoomTheme } from './zotz-agent-room-theme'
import type {
  ZotzAgentRoomStageCallbacks,
  ZotzAgentRoomStageInput,
  ZotzRoomAgent,
  ZotzRoomMail
} from './zotz-agent-room-types'

type Point = { x: number; y: number }

const DRAG_SLOP = 4
const DOUBLE_CLICK_MS = 400
const SAVE_DELAY_MS = 600

export type ZotzAgentRoomStage = ReturnType<typeof createZotzAgentRoomStage>

export function createZotzAgentRoomStage(
  canvas: HTMLCanvasElement,
  callbacks: () => ZotzAgentRoomStageCallbacks
) {
  const ctx = canvas.getContext('2d')
  let input: ZotzAgentRoomStageInput = {
    agents: [],
    links: [],
    guides: [],
    selected: null,
    positions: undefined,
    reduced: false,
    height: 200,
    columns: 0
  }
  let width = 0
  const spots = new Map<string, ZotzRoomSpot>()
  const edgeAnims = new Map<string, EdgeAnim>()
  const hops = new Map<string, number>()
  let packets: Packet[] = []
  const seenMail = new Set<string>()
  let drag: { key: string; dx: number; dy: number; sx: number; sy: number; moved: boolean } | null =
    null
  // Settling gives up after a couple of seconds, so a crowded stage can't spin forever.
  let settle: { pinned: string | null; frames: number } | null = null
  let lastClick = { key: '', at: NEVER }
  let saveTimer = 0
  let fastFrame = 0
  let stopClock: (() => void) | null = null

  const pointOf = (key: string): Point => {
    const spot = spots.get(key) ?? { fx: 0.5, fy: 0.5 }
    return { x: Math.round(spot.fx * width), y: Math.round(spot.fy * input.height) }
  }
  const edgeAnim = (pair: string): EdgeAnim => {
    let anim = edgeAnims.get(pair)
    if (!anim) {
      anim = { heatAt: NEVER, bumpAt: NEVER, bornAt: null, writer: null }
      edgeAnims.set(pair, anim)
    }
    return anim
  }

  const tagWidthOf = (agent: ZotzRoomAgent): number =>
    ctx
      ? zotzRoomTagWidth(
          ctx,
          agent.label,
          agent.current ?? false,
          { branded: Boolean(agent.agent), grouped: agent.inGroup ?? false },
          zotzAgentRoomTheme()
        )
      : 0

  /** New agents get their saved spot or a default one; waits for a width so rows fit the room. */
  function placeNewAgents(): void {
    // Columns come from the measured width; placing earlier would use the wrong rows.
    if (
      input.columns > 0 &&
      placeZotzRoomAgents(spots, input.agents, input.positions, input.columns)
    ) {
      settle = { pinned: settle?.pinned ?? null, frames: 0 }
    }
  }

  /** Pushes overlapping robots apart: a step per frame, or all at once without motion. */
  function settleStep(): void {
    if (!settle || !ctx || width === 0 || input.columns === 0) {
      return
    }
    const { agents: nodes, reduced } = input
    const tagWidths = nodes.map(tagWidthOf)
    const list = nodes.map((node) => ({ ...(spots.get(node.key) ?? { fx: 0.5, fy: 0.5 }) }))
    const pinnedKey = drag?.moved ? drag.key : settle.pinned
    const pinned = pinnedKey ? nodes.findIndex((node) => node.key === pinnedKey) : -1
    const done = settleZotzRoomSpots(list, tagWidths, pinned, width, input.height, reduced)
    nodes.forEach((node, index) => spots.set(node.key, list[index]))
    settle.frames += 1
    if ((done || settle.frames > 150) && !drag?.moved) {
      settle = null
    }
  }

  function save(): void {
    saveTimer = 0
    const positions: Record<string, [number, number]> = {}
    for (const node of input.agents) {
      const spot = spots.get(node.key)
      if (spot) {
        positions[node.key] = [Math.round(spot.fx * 1000) / 1000, Math.round(spot.fy * 1000) / 1000]
      }
    }
    callbacks().onPositionsChange(positions)
  }

  /** Saves once the neighbors finished stepping aside. */
  function scheduleSave(): void {
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(save, SAVE_DELAY_MS)
  }

  function draw(now: number): void {
    if (!ctx || width === 0 || input.columns === 0) {
      return
    }
    settleStep()
    packets = deliverZotzRoomMail(packets, now, edgeAnim, hops)
    const scene = buildZotzRoomScene({
      input,
      width,
      now,
      pointOf,
      edgeAnims,
      hops,
      packets,
      carried: drag?.moved ? drag.key : null
    })
    input.agents.forEach((agent) => {
      const at = pointOf(agent.key)
      const tagWidth = tagWidthOf(agent)
      callbacks().place(agent.key, at.x, at.y, {
        left: zotzRoomTagLeft(at.x, tagWidth),
        width: tagWidth
      })
    })
    paintZotzAgentRoom(ctx, scene, zotzSpriteTheme(), zotzAgentRoomTheme(), now, input.reduced)
  }

  const needsFastFrames = (now: number): boolean =>
    packets.length > 0 ||
    settle !== null ||
    Boolean(drag?.moved) ||
    [...hops.values()].some((at) => now - at < MAIL_BUBBLE_MS) ||
    [...edgeAnims.values()].some((anim) => anim.bornAt !== null && now - anim.bornAt < GROW_MS)

  /** Smooth frames while something travels; the shared 80 ms clock covers the rest. */
  function kick(): void {
    if (fastFrame) {
      return
    }
    const step = (now: number): void => {
      draw(now)
      fastFrame = needsFastFrames(now) ? requestAnimationFrame(step) : 0
    }
    fastFrame = requestAnimationFrame(step)
  }

  const hitTest = (x: number, y: number): string | null =>
    hitZotzRoomAgent(
      input.agents.map((agent) => ({ key: agent.key, at: pointOf(agent.key) })),
      x,
      y
    )

  function local(event: PointerEvent | React.PointerEvent): Point {
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function moveTo(key: string, x: number, y: number): void {
    spots.set(key, clampZotzRoomSpot({ fx: x / width, fy: y / input.height }, width, input.height))
    settle = { pinned: key, frames: 0 }
  }

  function resize(nextWidth: number): void {
    const scale = window.devicePixelRatio || 1
    width = Math.max(1, Math.round(nextWidth))
    canvas.width = width * scale
    canvas.height = input.height * scale
    ctx?.setTransform(scale, 0, 0, scale, 0, 0)
    settle = { pinned: null, frames: 0 }
    placeNewAgents()
    draw(performance.now())
    kick()
  }

  return {
    update(next: ZotzAgentRoomStageInput): void {
      const heightChanged = next.height !== input.height
      input = next
      placeNewAgents()
      if (heightChanged && width > 0) {
        resize(width)
        return
      }
      draw(performance.now())
      kick()
    },
    resize,
    setVisible(visible: boolean): void {
      if (visible && !stopClock) {
        stopClock = subscribeZotzSpriteClock((now) => {
          if (!fastFrame) {
            draw(now)
          }
        })
      } else if (!visible) {
        stopClock?.()
        stopClock = null
      }
    },
    /** Mail that arrived before this room was on screen: no envelopes for it. */
    skip(mail: readonly ZotzRoomMail[]): void {
      mail.forEach((message) => seenMail.add(message.id))
    },
    /** Mail that just arrived: an envelope flies from writer to reader, or the line just lights up. */
    receive(mail: readonly ZotzRoomMail[]): void {
      const fresh = mail.filter((message) => !seenMail.has(message.id))
      fresh.forEach((message) => seenMail.add(message.id))
      packets.push(
        ...scheduleZotzRoomMail(fresh, {
          present: new Set(input.agents.map((agent) => agent.key)),
          reduced: input.reduced,
          now: performance.now(),
          pointOf,
          edgeAnim
        })
      )
      kick()
    },
    pointerDown(event: React.PointerEvent<HTMLCanvasElement>): void {
      const at = local(event)
      const key = hitTest(at.x, at.y)
      if (!key) {
        if (input.selected !== null) {
          callbacks().onSelect(null)
        }
        return
      }
      const feet = pointOf(key)
      drag = { key, dx: at.x - feet.x, dy: at.y - feet.y, sx: at.x, sy: at.y, moved: false }
      canvas.setPointerCapture(event.pointerId)
      canvas.style.cursor = 'grabbing'
    },
    pointerMove(event: React.PointerEvent<HTMLCanvasElement>): void {
      const at = local(event)
      if (!drag) {
        canvas.style.cursor = hitTest(at.x, at.y) ? 'grab' : ''
        return
      }
      if (!drag.moved && Math.hypot(at.x - drag.sx, at.y - drag.sy) < DRAG_SLOP) {
        return
      }
      drag.moved = true
      moveTo(drag.key, at.x - drag.dx, at.y - drag.dy)
      kick()
    },
    pointerUp(): void {
      if (!drag) {
        return
      }
      const { key, moved } = drag
      drag = null
      canvas.style.cursor = 'grab'
      if (moved) {
        settle = { pinned: key, frames: 0 }
        scheduleSave()
        kick()
      } else if (key === lastClick.key && performance.now() - lastClick.at < DOUBLE_CLICK_MS) {
        // Second click of a double click: open it and leave the selection from the first.
        lastClick = { key: '', at: NEVER }
        callbacks().onOpen(key)
      } else {
        lastClick = { key, at: performance.now() }
        callbacks().onSelect(input.selected === key ? null : key)
      }
    },
    /** Keyboard move, in pixels. */
    nudge(key: string, dx: number, dy: number): void {
      const at = pointOf(key)
      moveTo(key, at.x + dx, at.y + dy)
      scheduleSave()
      draw(performance.now())
      kick()
    },
    destroy(): void {
      stopClock?.()
      cancelAnimationFrame(fastFrame)
      if (saveTimer) {
        window.clearTimeout(saveTimer)
        save()
      }
    }
  }
}
