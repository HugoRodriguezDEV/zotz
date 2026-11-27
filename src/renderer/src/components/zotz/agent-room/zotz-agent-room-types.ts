import type { AgentType } from '../../../../../shared/agent-status/contracts/agent-status-types'
import type { AgentListStatus } from '../../../../../shared/agent-status/presentation/agent-list-status'

/** One robot in the room. */
export type ZotzRoomAgent = {
  /** Stable id (e.g. `host\npath`); keys links, mail, selection and the saved spot. */
  key: string
  /** Short name on its tag; picks its robot color, like the rows do, when its model has none. */
  label: string
  /** Null reads as idle. */
  state: AgentListStatus | null
  /** Agent running in its chat (claude, codex…): colors the robot and puts its logo in the tag. */
  agent?: AgentType | null
  /** Belongs to a linked group: a small link mark at the end of its tag. */
  inGroup?: boolean
  /** Machine name when it lives on another machine (read to screen readers). */
  machine?: string | null
  /** The conversation open in this window: bolder name. */
  current?: boolean
}

/** A dotted line between two agents that wrote to each other. */
export type ZotzRoomLink = { a: string; b: string; count: number }

/** Mail that just arrived; `firstOfPair` grows a new line from the writer. */
export type ZotzRoomMail = { id: string; from: string; to: string; firstOfPair: boolean }

/** A faint dashed line from a child conversation to the one that created it. */
export type ZotzRoomGuide = { child: string; parent: string }

/** Saved spots by agent key, as fractions of the room. */
export type ZotzRoomPositions = Readonly<Record<string, readonly [number, number]>>

export type ZotzAgentRoomStageInput = {
  agents: readonly ZotzRoomAgent[]
  links: readonly ZotzRoomLink[]
  guides: readonly ZotzRoomGuide[]
  selected: string | null
  positions: ZotzRoomPositions | undefined
  reduced: boolean
  height: number
  /** 0 until the room's width is known. */
  columns: number
}

export type ZotzAgentRoomStageCallbacks = {
  onSelect: (key: string | null) => void
  onPositionsChange: (positions: Record<string, [number, number]>) => void
  /** Keeps each agent's HTML overlays (focus box, logo, group mark) on its robot and name tag. */
  place: (key: string, x: number, y: number, tag: { left: number; width: number }) => void
  /** Double click on a robot. */
  onOpen: (key: string) => void
}
