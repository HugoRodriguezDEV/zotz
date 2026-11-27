// Turns the room's live state (spots, mail in flight, recent arrivals) into one frame to paint.

import { agentAnimationSeed, agentBodyColorFor } from '../agent-sprite/zotz-agent-sprite-art'
import {
  zotzRoomChest,
  type ZotzRoomAgentFrame,
  type ZotzRoomEdgeFrame,
  type ZotzRoomSceneFrame
} from './zotz-agent-room-paint'
import type { ZotzAgentRoomStageInput, ZotzRoomMail } from './zotz-agent-room-types'

type Point = { x: number; y: number }

/** A line's recent life: when mail last lit it, when its count went up, when it first appeared. */
export type EdgeAnim = {
  heatAt: number
  bumpAt: number
  bornAt: number | null
  writer: string | null
}
/** An envelope from one agent key to another; it lands at `t0 + dur`. */
export type Packet = { pair: string; from: string; to: string; t0: number; dur: number }

export const HEAT_MS = 2400
export const HOP_MS = 380
export const MAIL_BUBBLE_MS = 900
export const GROW_MS = 700
export const NEVER = -1e9
const STAGGER_MS = 260

export const pairOf = (a: string, b: string): string =>
  a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`
export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))
const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

export function buildZotzRoomScene({
  input,
  width,
  now,
  pointOf,
  edgeAnims,
  hops,
  packets,
  carried
}: {
  input: ZotzAgentRoomStageInput
  width: number
  now: number
  pointOf: (key: string) => Point
  edgeAnims: ReadonlyMap<string, EdgeAnim>
  /** When each agent last received mail. */
  hops: ReadonlyMap<string, number>
  packets: readonly Packet[]
  /** Key of the robot being dragged. */
  carried: string | null
}): ZotzRoomSceneFrame {
  const { agents, links, guides, selected, reduced, height } = input
  const present = new Set(agents.map((agent) => agent.key))
  const most = Math.max(1, ...links.map((link) => link.count))
  const edges = links.flatMap((link): ZotzRoomEdgeFrame[] => {
    if (!present.has(link.a) || !present.has(link.b) || link.a === link.b) {
      return []
    }
    const pair = pairOf(link.a, link.b)
    const anim = edgeAnims.get(pair)
    const pending = packets.filter((packet) => packet.pair === pair)
    const flying = pending.some((packet) => now >= packet.t0)
    const writer = anim?.writer === link.b ? link.b : link.a
    const reader = writer === link.a ? link.b : link.a
    const sinceHeat = (now - (anim?.heatAt ?? NEVER)) / HEAT_MS
    return [
      {
        from: pointOf(writer),
        to: pointOf(reader),
        count: link.count - pending.length,
        thick: link.count / most > 0.6,
        heat: flying ? 1 : sinceHeat >= 0 && sinceHeat < 1 ? 1 - easeInOut(sinceHeat) : 0,
        dimmed: selected !== null && link.a !== selected && link.b !== selected,
        grown: anim?.bornAt == null ? 1 : clamp01((now - anim.bornAt) / GROW_MS),
        bumped: now - (anim?.bumpAt ?? NEVER) < 420
      }
    ]
  })
  const frames = agents.map((agent): ZotzRoomAgentFrame => {
    const at = pointOf(agent.key)
    const sinceHop = (now - (hops.get(agent.key) ?? NEVER)) / HOP_MS
    const hop =
      !reduced && sinceHop >= 0 && sinceHop < 1 ? Math.round(Math.sin(Math.PI * sinceHop) * 7) : 0
    return {
      label: agent.label,
      current: agent.current ?? false,
      branded: Boolean(agent.agent),
      grouped: agent.inGroup ?? false,
      state: agent.state ?? 'idle',
      color: agentBodyColorFor(agent.label),
      seed: agentAnimationSeed(agent.label),
      at,
      lift: hop + (carried === agent.key ? 6 : 0),
      mailBubble: !reduced && now - (hops.get(agent.key) ?? NEVER) < MAIL_BUBBLE_MS,
      selected: selected === agent.key,
      dimmed: selected !== null && selected !== agent.key
    }
  })
  return {
    width,
    height,
    agents: frames,
    edges,
    guides: guides.flatMap(({ child, parent }) =>
      present.has(child) && present.has(parent) && child !== parent
        ? [{ from: pointOf(child), to: pointOf(parent) }]
        : []
    ),
    packets: packets
      .filter((packet) => now >= packet.t0)
      .map((packet) => ({
        from: pointOf(packet.from),
        to: pointOf(packet.to),
        t: clamp01((now - packet.t0) / packet.dur)
      }))
  }
}

/**
 * Envelopes for mail that just arrived, a beat apart, writer to reader. A first message between two
 * agents grows their line from the writer. Without motion the line just lights up.
 */
export function scheduleZotzRoomMail(
  mail: readonly ZotzRoomMail[],
  {
    present,
    reduced,
    now,
    pointOf,
    edgeAnim
  }: {
    present: ReadonlySet<string>
    reduced: boolean
    now: number
    pointOf: (key: string) => Point
    edgeAnim: (pair: string) => EdgeAnim
  }
): Packet[] {
  const packets: Packet[] = []
  for (const message of mail) {
    if (!present.has(message.from) || !present.has(message.to) || message.from === message.to) {
      continue
    }
    const pair = pairOf(message.from, message.to)
    const anim = edgeAnim(pair)
    anim.writer = message.from
    if (reduced) {
      anim.heatAt = now
      continue
    }
    const t0 = now + packets.length * STAGGER_MS
    if (message.firstOfPair) {
      anim.bornAt = t0
    }
    const p = zotzRoomChest(pointOf(message.from))
    const q = zotzRoomChest(pointOf(message.to))
    const dur = Math.min(1000, Math.max(520, Math.hypot(q.x - p.x, q.y - p.y) / 0.24))
    packets.push({ pair, from: message.from, to: message.to, t0, dur })
  }
  return packets
}

/** Lands envelopes whose flight ended: the line lights, the count bumps, the reader hops. */
export function deliverZotzRoomMail(
  packets: readonly Packet[],
  now: number,
  edgeAnim: (pair: string) => EdgeAnim,
  hops: Map<string, number>
): Packet[] {
  return packets.filter((packet) => {
    if (now < packet.t0 + packet.dur) {
      return true
    }
    const anim = edgeAnim(packet.pair)
    anim.heatAt = now
    anim.bumpAt = now
    hops.set(packet.to, now)
    return false
  })
}
