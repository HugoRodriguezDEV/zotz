// Pixel art for the Zotz agent: a small robot whose face, pose and badge show the agent's state.
// Each string is one row of cells; letters pick a color in the painter.

/** Full body, 12×14 cells. o outline, b body, l highlight, s shade, v visor, a antenna tip. */
export const AGENT_BODY = [
  '.....aa.....',
  '.....oo.....',
  '..oooooooo..',
  '.obllllllbo.',
  '.obvvvvvvbo.',
  '.obvvvvvvbo.',
  '.obvvvvvvbo.',
  '.obvvvvvvbo.',
  '.obssssssbo.',
  '..oooooooo..',
  '...obbbbo...',
  '...obssbo...',
  '...oooooo...',
  '....o..o....'
] as const

/** Rows of AGENT_BODY that make the head (rows 0–9). */
export const AGENT_HEAD_ROWS = 10

export const AGENT_COLS = 12

/** Overlay placed relative to the body: first column, first row, rows. */
export type SpriteOverlay = { col: number; row: number; rows: readonly string[] }

// w glove, g glove shade, o outline, b body.
export const RAISED_HAND = [
  '..o.o.o..',
  '.owowowo.',
  '.owowowoo',
  '.owwwwwwo',
  '.owgwwwo.',
  '..owwwo..',
  '...obo...'
] as const

/** Small hand beside the head for the row-size sprite. */
export const ROW_HAND: SpriteOverlay = {
  col: -3,
  row: -1,
  rows: ['.oo.', 'owwo', 'owwo', 'oowo', '.obo', '.obo', '.obo', '.obo']
}

export const THUMBS_UP: SpriteOverlay = {
  col: 9,
  row: 5,
  rows: ['.oo....', 'owwo...', 'owwoooo', 'owwwwwo', 'owwgggo', 'owwwwwo', 'owwgggo', '.ooooo.']
}

/** Check above the head; k is the success color. */
export const DONE_CHECK: SpriteOverlay = {
  col: 2,
  row: -6,
  rows: ['.......oo', '......okko', '.oo..okko', 'okkookko.', '.okkkko..', '..okko...', '...oo....']
}

/** Padlock the agent bumps into when it needs permission; y is gold. */
export const PADLOCK = ['.oo.', 'o..o', 'oooo', 'oyyo', 'oooo'] as const

/** Warning sign; r is the danger color, w is white. */
export const WARNING_SIGN = [
  '....r....',
  '...rrr...',
  '...rwr...',
  '..rrwrr..',
  '..rrwrr..',
  '.rrrrrrr.',
  '.rrrwrrr.',
  'rrrrrrrrr'
] as const

/** Letter for the group map; r is the live color. */
export const ENVELOPE = ['ooooooo', 'oowwwoo', 'owowowo', 'owwrwwo', 'ooooooo'] as const

/** One-color glyphs drawn on badges and bubbles (1 = filled). */
export const GLYPHS = {
  question: ['111', '001', '011', '000', '010'],
  exclamation: ['11', '11', '11', '00', '11'],
  sleep: ['111', '001', '010', '100', '111'],
  check: ['.....1', '....11', '1..11.', '1111..', '.11...'],
  hourglass: ['11111', '.111.', '..1..', '.111.', '11111'],
  ban: ['.111.', '1..11', '1.1.1', '11..1', '.111.']
} as const

export const SPRITE_INK = {
  outline: '#16161a',
  visor: '#222836',
  eye: '#e9f7ff',
  eyeDim: '#6f7785',
  paper: '#f3f4f6',
  white: '#ffffff',
  gold: '#d9a53f',
  glove: '#fafafa',
  gloveShade: '#bec4ce',
  laptop: '#3a3f4b',
  keyboard: '#9aa1ad'
} as const

export type AgentBodyColor = { body: string; light: string; shade: string }

// Fixed pixel-art hues for chats whose model has no color; none clash with the model colors.
export const AGENT_BODY_COLORS: readonly AgentBodyColor[] = [
  { body: '#4fae84', light: '#8ad3b1', shade: '#347f5e' },
  { body: '#a57be0', light: '#c9adf0', shade: '#7b55b6' },
  { body: '#d9a53f', light: '#ecc777', shade: '#a97c25' },
  { body: '#3fa7b5', light: '#7bcbd5', shade: '#2a7e8a' },
  { body: '#d96b9a', light: '#eda3c2', shade: '#ad4b75' }
]

function hashText(text: string): number {
  let hash = 0
  for (let index = 0; index < text.length; index++) {
    hash = (Math.imul(hash, 31) + text.charCodeAt(index)) >>> 0
  }
  return hash
}

// Brand-leaning bodies so the model reads at a glance: Claude's clay, Codex's white, Antigravity's blue.
const MODEL_BODY_COLORS: Record<string, AgentBodyColor> = {
  claude: { body: '#d97757', light: '#f0a98c', shade: '#ad5236' },
  'claude-agent-teams': { body: '#d97757', light: '#f0a98c', shade: '#ad5236' },
  codex: { body: '#d9dae0', light: '#ffffff', shade: '#9b9ca8' },
  antigravity: { body: '#4f86f7', light: '#93b6ff', shade: '#2f5ccc' }
}

/** The robot takes its model's color; unknown models keep one stable color per conversation. */
export function agentBodyColorFor(
  identity: string | undefined,
  agentType?: string | null
): AgentBodyColor {
  const modelColor = agentType ? MODEL_BODY_COLORS[agentType] : undefined
  if (modelColor) {
    return modelColor
  }
  return identity
    ? AGENT_BODY_COLORS[hashText(identity) % AGENT_BODY_COLORS.length]
    : AGENT_BODY_COLORS[0]
}

/** Offsets each robot's blinks and loops so a list doesn't move in lockstep. */
export function agentAnimationSeed(identity: string | undefined): number {
  return identity ? hashText(`${identity}:seed`) % 3600 : 0
}
