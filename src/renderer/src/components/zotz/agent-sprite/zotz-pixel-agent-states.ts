import type { WorktreeStatus } from '../../../../../shared/worktree/row-display/worktree-status-rollup'
import type { ZotzSpriteState } from './zotz-agent-sprite-look'

/** Zotz draws agent states as pixel robots instead of upstream's glyphs. */
export const ZOTZ_PIXEL_AGENT_STATES = true

/** A workspace's rolled-up status as a robot state; a quiet live terminal reads like a finished one, as upstream draws it. */
export function zotzSpriteStateForWorktree(status: WorktreeStatus): ZotzSpriteState {
  switch (status) {
    case 'active':
      return 'done'
    case 'inactive':
      return 'idle'
    case 'working':
    case 'monitoring':
    case 'permission':
    case 'failed':
    case 'interrupted':
    case 'unconfirmed':
    case 'done':
      return status
  }
}
