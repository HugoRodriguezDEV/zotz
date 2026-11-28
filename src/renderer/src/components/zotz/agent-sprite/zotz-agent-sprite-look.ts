import type { AgentListStatus } from '../../../../../shared/agent-status/presentation/agent-list-status'
import type { AgentBodyColor } from './zotz-agent-sprite-art'
import type { ZotzSpriteTheme } from './zotz-agent-sprite-theme'

/** Every agent/conversation state the robot can show. */
export type ZotzSpriteState = AgentListStatus | 'unread' | 'queued' | 'canceled'

export type SpriteEyes = 'normal' | 'down' | 'up' | 'wide' | 'happy' | 'closed' | 'half' | 'x'
export type SpriteBadge =
  | 'working'
  | 'question'
  | 'exclamation'
  | 'check'
  | 'unread'
  | 'sleep'
  | 'pause'
  | 'warning'
  | 'stop'
  | 'hourglass'
  | 'ban'
export type SpriteBubble = 'dots' | 'question' | 'exclamation' | 'sleep' | 'warning' | 'stop'

/** One frame of the robot: what its face, antenna, pose and signs look like right now. */
export type SpriteLook = {
  eyes: SpriteEyes
  eyeShift: number
  xEyeColor: string | null
  tip: string
  alpha: number
  laptop: boolean
  badge: SpriteBadge | null
  bubble: SpriteBubble | null
  pose: 'raised-hand' | 'reach' | 'thumbs-up' | null
  offsetX: number
  offsetY: number
  wave: number
  handLift: number
  bubbleShiftX: number
  bubbleLift: number
  reach: number
  padlock: boolean
  padlockShake: number
  padlockSparks: boolean
  antennaSparks: boolean
  warningOn: boolean
  thumbDrop: number
  checkVisible: boolean
  checkLift: number
}

/** The look of `state` at time `now`; `seed` staggers loops between robots. */
export function zotzSpriteLook(
  state: ZotzSpriteState,
  now: number,
  seed: number,
  reduced: boolean,
  color: AgentBodyColor,
  theme: ZotzSpriteTheme
): SpriteLook {
  const step = (ms: number): number => (reduced ? 0 : Math.floor((now + seed) / ms))
  const on = (ms: number): boolean => reduced || step(ms) % 2 === 0
  const cycle = (ms: number): number => (reduced ? 0.9 : ((now + seed) % ms) / ms)
  const look: SpriteLook = {
    eyes: 'normal',
    eyeShift: 0,
    xEyeColor: null,
    tip: color.shade,
    alpha: 1,
    laptop: false,
    badge: null,
    bubble: null,
    pose: null,
    offsetX: 0,
    offsetY: 0,
    wave: 0,
    handLift: 0,
    bubbleShiftX: 0,
    bubbleLift: 0,
    reach: 0,
    padlock: false,
    padlockShake: 0,
    padlockSparks: false,
    antennaSparks: false,
    warningOn: false,
    thumbDrop: 0,
    checkVisible: false,
    checkLift: 0
  }
  switch (state) {
    case 'working':
      // Looks down at its laptop and types.
      look.eyes = 'down'
      look.eyeShift = [0, 1, 0, -1][step(220) % 4]
      look.tip = on(400) ? theme.live : color.light
      look.laptop = true
      look.badge = 'working'
      look.bubble = 'dots'
      break
    case 'monitoring':
      look.eyeShift = [-1, 0, 1, 0][step(700) % 4]
      look.tip = on(700) ? theme.monitoring : color.shade
      break
    case 'waiting':
      // Hand up above the head, bobbing like "pick me"; the bubble hops with it.
      look.eyes = 'up'
      look.tip = theme.question
      look.badge = 'question'
      look.bubble = 'question'
      look.pose = 'raised-hand'
      look.wave = reduced ? 0 : step(380) % 2
      look.handLift = look.wave * 2
      look.bubbleShiftX = 14
      look.bubbleLift = look.wave
      break
    case 'permission':
    case 'blocked': {
      if (state === 'blocked') {
        look.tip = theme.danger
        look.badge = 'stop'
        look.bubble = 'stop'
        break
      }
      // Reaches for a padlock, bumps into it, steps back and looks at you.
      const phase = cycle(2600)
      look.tip = theme.question
      look.badge = 'exclamation'
      look.padlock = true
      look.pose = 'reach'
      if (phase < 0.3) {
        look.reach = Math.round((phase / 0.3) * 2)
        look.eyeShift = -1
      } else if (phase < 0.42) {
        look.reach = 2
        look.offsetX = -1
        look.padlockShake = Math.floor(now / 50) % 2 ? 1 : -1
        look.padlockSparks = true
        look.eyes = 'x'
        look.xEyeColor = theme.question
      } else if (phase < 0.56) {
        look.offsetX = 1
        look.eyes = 'wide'
      } else {
        look.eyes = 'wide'
        look.bubble = 'exclamation'
        look.tip = on(300) ? theme.question : color.shade
      }
      break
    }
    case 'done': {
      // Thumbs up with a check on top; every few seconds the thumb pops up again.
      look.eyes = 'happy'
      look.tip = theme.success
      look.badge = 'check'
      look.pose = 'thumbs-up'
      look.checkVisible = true
      const phase = cycle(4500)
      if (!reduced && phase < 0.05) {
        look.thumbDrop = 2
        look.checkVisible = false
      } else if (!reduced && phase < 0.1) {
        look.thumbDrop = -1
        look.checkLift = -2
      } else {
        look.checkLift = reduced ? 0 : -(step(700) % 2)
      }
      break
    }
    case 'unread':
      look.eyes = 'happy'
      look.tip = theme.success
      look.badge = 'unread'
      break
    case 'idle':
      look.eyes = 'closed'
      look.tip = theme.muted
      look.badge = 'sleep'
      look.bubble = 'sleep'
      break
    case 'interrupted':
      look.eyes = 'half'
      look.tip = theme.muted
      look.badge = 'pause'
      break
    case 'failed': {
      // Alarm: antenna sparks, the body jolts and a warning sign flashes.
      const phase = cycle(1500)
      look.eyes = 'x'
      look.tip = on(150) ? theme.danger : theme.amber
      look.badge = 'warning'
      look.bubble = 'warning'
      look.antennaSparks = !reduced
      look.warningOn = reduced || phase < 0.7
      if (!reduced && phase < 0.22) {
        look.offsetX = Math.floor(now / 45) % 2 ? 1 : -1
      }
      break
    }
    case 'unconfirmed':
    case 'unverifiable':
      look.alpha = 0.5
      look.tip = on(1100) ? theme.amber : color.shade
      break
    case 'queued':
      look.eyeShift = [-1, 0, 1, 0][step(900) % 4]
      look.tip = theme.pending
      look.badge = 'hourglass'
      break
    case 'canceled':
      look.eyes = 'half'
      look.alpha = 0.6
      look.tip = theme.muted
      look.badge = 'ban'
      break
  }
  return look
}
