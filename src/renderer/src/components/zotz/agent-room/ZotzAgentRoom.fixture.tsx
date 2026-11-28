import { useAppStore } from '@/store/index'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import { ZotzAgentRoom, type ZotzRoomAgent } from './ZotzAgentRoom'

const NAMES = [
  'salmon',
  'albatross',
  'heron',
  'tautog',
  'palolo',
  'barracuda',
  'marlin',
  'grouper',
  'wahoo',
  'snapper',
  'remora',
  'tarpon'
]
const STATES = ['working', 'done', 'idle', 'waiting', 'permission'] as const
const AGENTS = ['claude', 'codex', 'antigravity', null] as const

const machine = (count: number): ZotzRoomAgent[] =>
  NAMES.slice(0, count).map((name, index) => ({
    key: name,
    label: name,
    state: STATES[index % STATES.length],
    agent: AGENTS[index % AGENTS.length],
    inGroup: index < 3,
    current: index === 0
  }))

// A whole machine's conversations in a wide panel: rows grow to fit the width; the first three are in a group.
export const machineRoom = defineFixture({
  width: 600,
  render: () => (
    <div className="p-2">
      <ZotzAgentRoom
        agents={machine(12)}
        label="Local Mac"
        links={[
          { a: 'salmon', b: 'albatross', count: 5 },
          { a: 'heron', b: 'wahoo', count: 2 }
        ]}
        onSelect={() => {}}
        onOpen={() => {}}
      />
    </div>
  )
})

// Eight in a narrow panel; two saved on the same spot step apart on their own.
export const crowded = defineFixture({
  width: 340,
  setup: () => {
    useAppStore.setState((state) => ({
      settings: state.settings && {
        ...state.settings,
        zotzAgentRoomPositions: { 'fixture:crowded': { tautog: [0.5, 0.5], palolo: [0.5, 0.5] } }
      }
    }))
  },
  render: () => (
    <div className="p-2">
      <ZotzAgentRoom
        agents={machine(8)}
        label="Crowded"
        roomKey="fixture:crowded"
        links={[
          { a: 'salmon', b: 'albatross', count: 4 },
          { a: 'heron', b: 'barracuda', count: 6 }
        ]}
      />
    </div>
  ),
  interact: () => new Promise((resolve) => window.setTimeout(resolve, 1200))
})

// Twelve in a narrow panel: two per row, nobody on top of anybody.
export const twelveNarrow = defineFixture({
  width: 340,
  render: () => (
    <div className="p-2">
      <ZotzAgentRoom agents={machine(12)} label="Local Mac" />
    </div>
  )
})

const FOURTEEN = [...NAMES, 'lanternfish', 'bullhead']
const BUSY_STATES = ['waiting', 'working', 'idle', 'permission', 'done', 'blocked'] as const

// Fourteen with bubbles and raised hands; five were dragged into one column, too close: they step apart.
export const fourteenWithBubbles = defineFixture({
  width: 460,
  setup: () => {
    useAppStore.setState((state) => ({
      settings: state.settings && {
        ...state.settings,
        zotzAgentRoomPositions: {
          'fixture:fourteen': {
            lanternfish: [0.86, 0.35],
            bullhead: [0.86, 0.48],
            tarpon: [0.86, 0.6],
            remora: [0.86, 0.72],
            snapper: [0.88, 0.84]
          }
        }
      }
    }))
  },
  render: () => (
    <div className="p-2">
      <ZotzAgentRoom
        agents={FOURTEEN.map((name, index) => ({
          key: name,
          label: name,
          state: BUSY_STATES[index % BUSY_STATES.length],
          agent: AGENTS[index % AGENTS.length],
          inGroup: index < 2,
          current: index === 0
        }))}
        label="Local Mac"
        roomKey="fixture:fourteen"
        links={[{ a: 'salmon', b: 'albatross', count: 3 }]}
        guides={[
          { child: 'heron', parent: 'salmon' },
          { child: 'tautog', parent: 'salmon' },
          { child: 'bullhead', parent: 'lanternfish' }
        ]}
      />
    </div>
  ),
  interact: () => new Promise((resolve) => window.setTimeout(resolve, 1200))
})
