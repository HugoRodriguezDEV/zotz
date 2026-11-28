// Pixel art for background work that is not an agent. Each device fits the robot's 32×22 row slot:
// a 12×11-cell body at 2 px per cell, with its state sign in the top-right corner like the robot's badge.

/** Fixed device colors: screens and lights read the same on light and dark sidebars. */
export const PROCESS_INK = {
  outline: '#16161a',
  frame: '#c9ccd6',
  frameDim: '#9aa0ad',
  paper: '#e9ebf0',
  paperDim: '#c3c7d0',
  line: '#aab0bc',
  screen: '#0e1a14',
  screenFault: '#2a0f12',
  off: '#23262e',
  text: '#4ade80',
  step: '#16a34a',
  live: '#4f8cff',
  liveDim: '#2f5ccc',
  blip: '#facc15',
  blipDim: '#5c4b10',
  amberDim: '#b45309',
  gray: '#969ca8',
  grayDim: '#5b616c',
  cursor: '#e6edf3',
  static: '#6b7280',
  staticDark: '#3a3f4b',
  chip: '#2b2f3a'
} as const

/** Terminal: o outline, f frame, s screen, l power light. */
export const TERMINAL = [
  'oooooooooooo',
  'offffffffffo',
  'ofssssssssfo',
  'ofssssssssfo',
  'ofssssssssfo',
  'ofssssssssfo',
  'ofssssssssfo',
  'offffffflffo',
  'oooooooooooo',
  '....oooo....',
  '...oooooo...'
] as const

/** Clipboard of three steps: p paper, L step text, 1–3 the step boxes. */
export const CLIPBOARD = [
  '....oooo....',
  '.ffffffffff.',
  '.fppppppppf.',
  '.fp11pLLLpf.',
  '.fppppppppf.',
  '.fp22pLLLpf.',
  '.fppppppppf.',
  '.fp33pLLLpf.',
  '.fppppppppf.',
  '.ffffffffff.',
  '............'
] as const

/** Two gear frames that alternate while it turns. */
export const GEAR_FRAMES = [
  [
    '....kkk....',
    '.kk.kkk.kk.',
    '.kkkkkkkkk.',
    '..kkkkkkk..',
    'kkkk...kkkk',
    'kkkk...kkkk',
    'kkkk...kkkk',
    '..kkkkkkk..',
    '.kkkkkkkkk.',
    '.kk.kkk.kk.',
    '....kkk....'
  ],
  [
    '.kk.....kk.',
    '.kkk.k.kkk.',
    '..kkkkkkk..',
    '.kkkkkkkkk.',
    '.kkk...kkk.',
    '.kkk...kkk.',
    '.kkk...kkk.',
    '.kkkkkkkkk.',
    '..kkkkkkk..',
    '.kkk.k.kkk.',
    '.kk.....kk.'
  ]
] as const

/** Server rack: L drive slots, d dark panel, 1–6 its lights. */
export const RACK = [
  '.oooooooooo.',
  '.offffffffo.',
  '.ofLLLd12fo.',
  '.offffffffo.',
  '.ofLLLd34fo.',
  '.offffffffo.',
  '.ofLLLd56fo.',
  '.offffffffo.',
  '.oooooooooo.',
  '..oo....oo..',
  '............'
] as const

/** Chip with pins: c die, x core light, y progress-bar track. */
export const CHIP = [
  '...o.o.o.o..',
  '.oooooooooo.',
  'oocccccccco.',
  '.occcxxccco.',
  'oocccxxcccoo',
  '.occcccccco.',
  'oocccccccco.',
  '.ocyyyyyyco.',
  '.oooooooooo.',
  '...o.o.o.o..',
  '............'
] as const

/** Failure cross and sign-in key (1 = filled). */
export const CROSS = ['1..1', '.11.', '.11.', '1..1'] as const
export const KEY = ['.11..', '1..11', '.11.1'] as const
