// Paints the group map's "room": dotted floor, pixel lines between members who wrote to each other,
// the full-body robots with their bubbles and name tags, and envelopes in flight.

import { ENVELOPE, SPRITE_INK, type AgentBodyColor } from '../agent-sprite/zotz-agent-sprite-art'
import { paintSpriteBubble } from '../agent-sprite/zotz-agent-sprite-bubble'
import { zotzSpriteLook, type ZotzSpriteState } from '../agent-sprite/zotz-agent-sprite-look'
import { paintAgent, paintCells } from '../agent-sprite/zotz-agent-sprite-paint'
import type { ZotzSpriteTheme } from '../agent-sprite/zotz-agent-sprite-theme'
import {
  ZOTZ_MAP_SPRITE_H,
  ZOTZ_MAP_SPRITE_SCALE,
  ZOTZ_MAP_SPRITE_W
} from './zotz-group-map-layout'
import type { ZotzGroupMapTheme } from './zotz-group-map-theme'

type Point = { x: number; y: number }

export type ZotzStageAgent = {
  label: string
  /** The conversation open in this window: bolder name. */
  current: boolean
  state: ZotzSpriteState
  color: AgentBodyColor
  seed: number
  /** Feet, in CSS pixels. */
  at: Point
  /** Pixels above the floor (a hop or being carried). */
  lift: number
  mailBubble: boolean
  selected: boolean
  dimmed: boolean
}

export type ZotzStageEdge = {
  from: Point
  to: Point
  count: number
  thick: boolean
  /** 0 = resting, 1 = mail on the move; dots run from `from` to `to` while lit. */
  heat: number
  dimmed: boolean
  /** How much of the line is drawn, growing from `from` (1 = all of it). */
  grown: number
  /** The count just went up: draw it a size bigger. */
  bumped: boolean
}

export type ZotzStageScene = {
  width: number
  height: number
  agents: readonly ZotzStageAgent[]
  edges: readonly ZotzStageEdge[]
  parentEdges: readonly { from: Point; to: Point }[]
  /** Envelopes in flight, `t` from 0 (sender) to 1 (receiver). */
  packets: readonly { from: Point; to: Point; t: number }[]
}

const TAG_HEIGHT = 17
const DOT_STEP = 7

export function zotzMapChest(feet: Point): Point {
  return { x: feet.x, y: feet.y - ZOTZ_MAP_SPRITE_H / 2 }
}

export function zotzMapTagLabel(label: string): string {
  return label.length > 12 ? `${label.slice(0, 11)}…` : label
}

function tagFont(current: boolean, theme: ZotzGroupMapTheme): string {
  return `${current ? 600 : 500} 11px ${theme.fontFamily}`
}

/** Width of an agent's name tag; the layout keeps tags from overlapping. */
export function zotzMapTagWidth(
  ctx: CanvasRenderingContext2D,
  label: string,
  current: boolean,
  theme: ZotzGroupMapTheme
): number {
  ctx.font = tagFont(current, theme)
  return Math.ceil(ctx.measureText(zotzMapTagLabel(label)).width) + 14
}

function frame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillRect(x, y, w, 1)
  ctx.fillRect(x, y + h - 1, w, 1)
  ctx.fillRect(x, y, 1, h)
  ctx.fillRect(x + w - 1, y, 1, h)
}

const easeOut = (t: number): number => 1 - (1 - t) ** 3

function paintEdge(
  ctx: CanvasRenderingContext2D,
  edge: ZotzStageEdge,
  theme: ZotzSpriteTheme,
  mapTheme: ZotzGroupMapTheme,
  now: number,
  reduced: boolean
): void {
  const p = zotzMapChest(edge.from)
  const q = zotzMapChest(edge.to)
  const length = Math.hypot(q.x - p.x, q.y - p.y)
  const size = edge.thick ? 3 : 2
  const start = ZOTZ_MAP_SPRITE_W / 2 + 6
  const grown = easeOut(edge.grown)
  for (let d = start; d < length - start; d += DOT_STEP) {
    const u = d / length
    if (u > grown) {
      break
    }
    const x = Math.round(p.x + (q.x - p.x) * u)
    const y = Math.round(p.y + (q.y - p.y) * u)
    if (edge.heat > 0 && !edge.dimmed) {
      // A bright dot every four runs toward the receiver.
      const wave = reduced ? 1 : (((d - now * 0.09) % 28) + 28) % 28 < DOT_STEP ? 1 : 0.35
      ctx.globalAlpha = Math.max(0.35, edge.heat * wave)
      ctx.fillStyle = theme.live
    } else {
      ctx.globalAlpha = edge.dimmed ? 0.18 : 0.45
      ctx.fillStyle = theme.muted
    }
    ctx.fillRect(x - size / 2, y - size / 2, size, size)
  }
  ctx.globalAlpha = 1
  if (edge.count <= 0 || length <= 120 || edge.dimmed || edge.grown < 1) {
    return
  }
  const mx = Math.round((p.x + q.x) / 2)
  const my = Math.round((p.y + q.y) / 2)
  const label = String(edge.count)
  ctx.font = `600 ${edge.bumped && !reduced ? 11 : 10}px ${mapTheme.fontFamily}`
  const w = Math.ceil(ctx.measureText(label).width) + 10
  const lit = edge.heat > 0
  ctx.fillStyle = mapTheme.card
  ctx.fillRect(mx - w / 2, my - 8, w, 16)
  ctx.fillStyle = lit ? theme.live : mapTheme.border
  frame(ctx, mx - w / 2, my - 8, w, 16)
  ctx.fillStyle = lit ? theme.foreground : theme.muted
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, mx, my + 0.5)
}

function paintParentEdge(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  theme: ZotzSpriteTheme
): void {
  const p = zotzMapChest(from)
  const q = zotzMapChest(to)
  const length = Math.hypot(q.x - p.x, q.y - p.y)
  const start = ZOTZ_MAP_SPRITE_W / 2 + 6
  ctx.globalAlpha = 0.3
  ctx.fillStyle = theme.muted
  // Short dashes, so a child → parent link never reads like mail.
  for (let d = start; d < length - start; d += 8) {
    for (let k = 0; k < 4 && d + k < length - start; k++) {
      const u = (d + k) / length
      ctx.fillRect(Math.round(p.x + (q.x - p.x) * u), Math.round(p.y + (q.y - p.y) * u), 1, 1)
    }
  }
  ctx.globalAlpha = 1
}

function paintAgentWithTag(
  ctx: CanvasRenderingContext2D,
  agent: ZotzStageAgent,
  theme: ZotzSpriteTheme,
  mapTheme: ZotzGroupMapTheme,
  now: number,
  reduced: boolean
): void {
  const { x, y } = agent.at
  const look = zotzSpriteLook(agent.state, now, agent.seed, reduced, agent.color, theme)
  ctx.fillStyle = mapTheme.shadow
  const shadow = agent.lift > 3 ? 18 : 26
  ctx.fillRect(Math.round(x - shadow / 2), y - 1, shadow, 3)
  ctx.fillRect(Math.round(x - shadow / 2) + 3, y + 2, shadow - 6, 2)
  const sx = Math.round(x - ZOTZ_MAP_SPRITE_W / 2)
  const sy = Math.round(y - ZOTZ_MAP_SPRITE_H - agent.lift)
  paintAgent(
    ctx,
    sx,
    sy,
    ZOTZ_MAP_SPRITE_SCALE,
    look,
    agent.color,
    theme,
    now,
    agent.seed,
    reduced,
    false
  )
  const bubbleTop = sy + look.offsetY * ZOTZ_MAP_SPRITE_SCALE - look.bubbleLift * 2
  const bubbleX = x + look.offsetX * ZOTZ_MAP_SPRITE_SCALE + look.bubbleShiftX
  const bubble = agent.mailBubble ? 'mail' : look.bubble
  if (bubble) {
    paintSpriteBubble(ctx, bubbleX, bubbleTop, bubble, look, theme, now, reduced)
  }
  // Name tag; its edge takes the state's color while the agent works or needs you.
  const name = zotzMapTagLabel(agent.label)
  const w = zotzMapTagWidth(ctx, agent.label, agent.current, mapTheme)
  const tx = Math.round(x - w / 2)
  const ty = y + 7
  ctx.fillStyle = mapTheme.card
  ctx.fillRect(tx, ty, w, TAG_HEIGHT)
  ctx.fillStyle = agent.selected
    ? theme.foreground
    : agent.state === 'working'
      ? theme.live
      : agent.state === 'waiting' || agent.state === 'permission'
        ? theme.question
        : mapTheme.border
  frame(ctx, tx, ty, w, TAG_HEIGHT)
  ctx.fillStyle = agent.dimmed ? theme.muted : theme.foreground
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, x, ty + 9)
}

export function paintZotzGroupStage(
  ctx: CanvasRenderingContext2D,
  scene: ZotzStageScene,
  theme: ZotzSpriteTheme,
  mapTheme: ZotzGroupMapTheme,
  now: number,
  reduced: boolean
): void {
  ctx.clearRect(0, 0, scene.width, scene.height)
  ctx.globalAlpha = mapTheme.floorAlpha
  ctx.fillStyle = theme.foreground
  for (let x = 6; x < scene.width; x += 12) {
    for (let y = 6; y < scene.height; y += 12) {
      ctx.fillRect(x, y, 2, 2)
    }
  }
  ctx.globalAlpha = 1
  scene.parentEdges.forEach(({ from, to }) => paintParentEdge(ctx, from, to, theme))
  scene.edges.forEach((edge) => paintEdge(ctx, edge, theme, mapTheme, now, reduced))
  // Farther back first, so a robot in front covers the one behind.
  ;[...scene.agents]
    .sort((a, b) => a.at.y - b.at.y)
    .forEach((agent) => paintAgentWithTag(ctx, agent, theme, mapTheme, now, reduced))
  for (const packet of scene.packets) {
    const p = zotzMapChest(packet.from)
    const q = zotzMapChest(packet.to)
    const t = packet.t < 0.5 ? 2 * packet.t * packet.t : 1 - (-2 * packet.t + 2) ** 2 / 2
    const arc = Math.sin(Math.PI * t) * Math.min(26, Math.hypot(q.x - p.x, q.y - p.y) * 0.18)
    const x = Math.round(p.x + (q.x - p.x) * t - 7)
    const y = Math.round(p.y + (q.y - p.y) * t - arc - 5)
    paintCells(ctx, ENVELOPE, x, y, 2, (c) =>
      c === 'o' ? SPRITE_INK.outline : c === 'w' ? SPRITE_INK.paper : c === 'r' ? theme.live : null
    )
  }
}
