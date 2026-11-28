import React from 'react'
import type { WorktreeStatus } from '../../../../../shared/worktree/row-display/worktree-status-rollup'
import { ZotzAgentSprite } from './ZotzAgentSprite'
import type { ZotzSpriteState } from './zotz-agent-sprite-look'
import { ZotzProcessSprite } from './ZotzProcessSprite'
import { ZOTZ_WATCHING_RADAR, type ZotzProcessSpec } from './zotz-process-sprite-spec'

type WorktreeMark = { process: ZotzProcessSpec } | { robot: ZotzSpriteState }

/** No agent: a server rack, lit while a terminal, server or browser is alive; only processes left: the radar. */
function worktreeMark(status: WorktreeStatus): WorktreeMark {
  switch (status) {
    case 'active':
    case 'inactive':
      return { process: { device: 'rack', state: status } }
    case 'monitoring':
      return { process: ZOTZ_WATCHING_RADAR }
    case 'working':
    case 'permission':
    case 'failed':
    case 'interrupted':
    case 'unconfirmed':
    case 'done':
      return { robot: status }
  }
}

/** A workspace's rolled-up status in the sidebar: a robot while an agent leads, a device otherwise. */
export function ZotzWorktreeStatusSprite({
  status,
  label
}: {
  status: WorktreeStatus
  label: string
}): React.JSX.Element {
  const mark = worktreeMark(status)
  return 'process' in mark ? (
    <ZotzProcessSprite sprite={mark.process} label={label} />
  ) : (
    <ZotzAgentSprite state={mark.robot} label={label} />
  )
}
