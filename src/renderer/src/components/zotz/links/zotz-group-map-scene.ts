// Turns the map's live state (spots, mail in flight, recent arrivals) into one frame to paint.

import { agentAnimationSeed, agentBodyColorFor } from '../agent-sprite/zotz-agent-sprite-art'
import type { ZotzGroupMapMail } from './zotz-group-map-edges'
import {
  zotzMapChest,
  type ZotzStageAgent,
  type ZotzStageEdge,
  type ZotzStageScene
} from './zotz-group-map-paint'
import type { ZotzGroupMapNode, ZotzGroupMapStageInput } from './zotz-group-map-types'

type Point = { x: number; y: number }

/** A line's recent life: when mail last lit it, when its count went up, when it first appeared. */
export type EdgeAnim = {
  heatAt: number
  bumpAt: number
  bornAt: number | null
  writer: string | null
}
/** An envelope from one member key to another; it lands at `t0 + dur`. */
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

export function buildZotzStageScene({
  input,
  width,
  now,
  pointOf,
  edgeAnims,
  hops,
  packets,
  carried
}: {
  input: ZotzGroupMapStageInput
  width: number
  now: number
  pointOf: (key: string) => Point
  edgeAnims: ReadonlyMap<string, EdgeAnim>
  /** When each member last received mail. */
  hops: ReadonlyMap<string, number>
  packets: readonly Packet[]
  /** Key of the robot being dragged. */
  carried: string | null
}): ZotzStageScene {
  const { nodes, edges, parentEdges, selected, reduced, height } = input
  const most = Math.max(1, ...edges.map((edge) => edge.count))
  const stageEdges = edges.flatMap((edge): ZotzStageEdge[] => {
    const a = nodes[edge.a]
    const b = nodes[edge.b]
    if (!a || !b) {
      return []
    }
    const pair = pairOf(a.key, b.key)
    const anim = edgeAnims.get(pair)
    const pending = packets.filter((packet) => packet.pair === pair)
    const flying = pending.some((packet) => now >= packet.t0)
    const writer = anim?.writer === b.key ? b : a
    const reader = writer === a ? b : a
    const sinceHeat = (now - (anim?.heatAt ?? NEVER)) / HEAT_MS
    return [
      {
        from: pointOf(writer.key),
        to: pointOf(reader.key),
        count: edge.count - pending.length,
        thick: edge.count / most > 0.6,
        heat: flying ? 1 : sinceHeat >= 0 && sinceHeat < 1 ? 1 - easeInOut(sinceHeat) : 0,
        dimmed: selected !== null && a.key !== selected && b.key !== selected,
        grown: anim?.bornAt == null ? 1 : clamp01((now - anim.bornAt) / GROW_MS),
        bumped: now - (anim?.bumpAt ?? NEVER) < 420
      }
    ]
  })
  const agents = nodes.map((node): ZotzStageAgent => {
    const at = pointOf(node.key)
    const sinceHop = (now - (hops.get(node.key) ?? NEVER)) / HOP_MS
    const hop =
      !reduced && sinceHop >= 0 && sinceHop < 1 ? Math.round(Math.sin(Math.PI * sinceHop) * 7) : 0
    const lift = carried === node.key ? 6 : 0
    return {
      label: node.label,
      current: node.current,
      state: node.state ?? 'idle',
      color: agentBodyColorFor(node.label),
      seed: agentAnimationSeed(node.label),
      at,
      lift: hop + lift,
      mailBubble: !reduced && now - (hops.get(node.key) ?? NEVER) < MAIL_BUBBLE_MS,
      selected: selected === node.key,
      dimmed: selected !== null && selected !== node.key
    }
  })
  return {
    width,
    height,
    agents,
    edges: stageEdges,
    parentEdges: parentEdges.flatMap(({ child, parent }) =>
      nodes[child] && nodes[parent]
        ? [{ from: pointOf(nodes[child].key), to: pointOf(nodes[parent].key) }]
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
 * members grows their line from the writer. Without motion the line just lights up.
 */
export function scheduleZotzMail(
  mail: readonly ZotzGroupMapMail[],
  {
    nodes,
    reduced,
    now,
    pointOf,
    edgeAnim
  }: {
    nodes: readonly ZotzGroupMapNode[]
    reduced: boolean
    now: number
    pointOf: (key: string) => Point
    edgeAnim: (pair: string) => EdgeAnim
  }
): Packet[] {
  const packets: Packet[] = []
  for (const message of mail) {
    const from = nodes[message.from]
    const to = nodes[message.to]
    if (!from || !to) {
      continue
    }
    const pair = pairOf(from.key, to.key)
    const anim = edgeAnim(pair)
    anim.writer = from.key
    if (reduced) {
      anim.heatAt = now
      continue
    }
    const t0 = now + packets.length * STAGGER_MS
    if (message.firstOfPair) {
      anim.bornAt = t0
    }
    const p = zotzMapChest(pointOf(from.key))
    const q = zotzMapChest(pointOf(to.key))
    const dur = Math.min(1000, Math.max(520, Math.hypot(q.x - p.x, q.y - p.y) / 0.24))
    packets.push({ pair, from: from.key, to: to.key, t0, dur })
  }
  return packets
}
