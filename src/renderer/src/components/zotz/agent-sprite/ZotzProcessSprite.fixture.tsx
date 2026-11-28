import { defineFixture } from '../../../component-fixtures/component-fixture'
import type { AgentChildDisplayState } from '../../../../../shared/agent-status/child-work/agent-status-child-work-display'
import StatusIndicator from '@/components/sidebar/workspace-card/surface/StatusIndicator'
import { CompactAgentRow } from '@/components/sidebar/workspace-card/activity/worktree-card-compact-agent-row'
import type { DashboardAgentRow } from '@/components/dashboard/rows/dashboard-agent-row'
import type { ProgramStatusFacet } from '../../../../../shared/program-status/facet'
import type { WorktreeStatus } from '../../../../../shared/worktree/row-display/worktree-status-rollup'
import { ZotzProcessSprite } from './ZotzProcessSprite'
import type { ZotzProcessSpec, ZotzTaskDevice } from './zotz-process-sprite-spec'

const TASK_STATES: AgentChildDisplayState[] = [
  'working',
  'monitoring',
  'waiting',
  'done',
  'failed',
  'blocked',
  'idle',
  'interrupted',
  'unverifiable'
]
const DEVICES: ZotzTaskDevice[] = ['command', 'monitor', 'workflow', 'unknown']

function Cell({ sprite, name }: { sprite: ZotzProcessSpec; name: string }): React.JSX.Element {
  return (
    <div className="flex w-20 flex-col items-center gap-1">
      <ZotzProcessSprite
        sprite={sprite}
        label={name}
        style={{ width: 64, height: 44, imageRendering: 'pixelated' }}
      />
      <span className="text-2xs text-muted-foreground">{name}</span>
    </div>
  )
}

function TaskGrid(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 bg-background p-3 text-foreground">
      {DEVICES.map((device) => (
        <div key={device} className="flex items-start gap-2">
          <span className="w-20 pt-3 text-xs font-medium">{device}</span>
          {TASK_STATES.map((state) => (
            <Cell key={state} sprite={{ device, state }} name={state} />
          ))}
        </div>
      ))}
    </div>
  )
}

export const tasks = defineFixture({ width: 820, render: () => <TaskGrid /> })

// Reduced motion stills every sign on, so the padlock and the cross show in one shot.
function preferReducedMotion(): void {
  const original = window.matchMedia.bind(window)
  window.matchMedia = (query) => {
    const list = original(query)
    return query === '(prefers-reduced-motion: reduce)'
      ? Object.defineProperty(list, 'matches', { value: true })
      : list
  }
}

export const tasksReducedMotion = defineFixture({
  width: 820,
  setup: preferReducedMotion,
  render: () => <TaskGrid />
})

export const programsReducedMotion = defineFixture({
  width: 720,
  setup: preferReducedMotion,
  render: () => <ProgramRow />
})

const WORKTREE_STATUSES: WorktreeStatus[] = [
  'active',
  'inactive',
  'monitoring',
  'working',
  'permission',
  'done'
]

// The sidebar's workspace mark: devices without an agent, the robot while one leads.
export const worktreeStatuses = defineFixture({
  width: 520,
  render: () => (
    <div className="flex gap-4 bg-worktree-sidebar p-3 text-foreground">
      {WORKTREE_STATUSES.map((status) => (
        <div key={status} className="flex flex-col items-center gap-1">
          <StatusIndicator status={status} />
          <span className="text-2xs text-muted-foreground">{status}</span>
        </div>
      ))}
    </div>
  )
})

export const workspace = defineFixture({
  width: 360,
  render: () => (
    <div className="flex gap-2 bg-background p-3 text-foreground">
      <Cell sprite={{ device: 'rack', state: 'active' }} name="active" />
      <Cell sprite={{ device: 'rack', state: 'inactive' }} name="inactive" />
      <Cell sprite={{ device: 'monitor', state: 'monitoring' }} name="monitoring" />
    </div>
  )
})

const PROGRAMS: { name: string; sprite: ZotzProcessSpec }[] = [
  { name: 'idle', sprite: { device: 'chip', state: 'idle' } },
  { name: 'working', sprite: { device: 'chip', state: 'working' } },
  { name: 'working 60%', sprite: { device: 'chip', state: 'working', progress: 60 } },
  { name: 'done', sprite: { device: 'chip', state: 'done' } },
  { name: 'permission', sprite: { device: 'chip', state: 'blocked', kind: 'permission' } },
  { name: 'question', sprite: { device: 'chip', state: 'blocked', kind: 'question' } },
  { name: 'auth', sprite: { device: 'chip', state: 'blocked', kind: 'auth' } },
  { name: 'error', sprite: { device: 'chip', state: 'error' } }
]

function ProgramRow(): React.JSX.Element {
  return (
    <div className="flex gap-2 bg-background p-3 text-foreground">
      {PROGRAMS.map(({ name, sprite }) => (
        <Cell key={name} sprite={sprite} name={name} />
      ))}
    </div>
  )
}

export const programs = defineFixture({ width: 720, render: () => <ProgramRow /> })

function programRow(
  id: string,
  agentType: string,
  prompt: string,
  state: 'working' | 'waiting' | 'blocked',
  facet: Omit<ProgramStatusFacet, 'observedAt'>
): DashboardAgentRow {
  const at = Date.UTC(2026, 10, 27, 9)
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the compact row reads only these fields.
  return {
    paneKey: `tab-${id}:pane`,
    entry: {
      state,
      prompt,
      updatedAt: at,
      stateStartedAt: at,
      stateHistory: [],
      agentType,
      paneKey: `tab-${id}:pane`,
      programStatus: { ...facet, observedAt: at }
    },
    tab: { id: `tab-${id}`, worktreeId: 'repo::/code/app', title: prompt, customTitle: null },
    agentType,
    rowSource: 'live',
    state,
    startedAt: at
  } as unknown as DashboardAgentRow
}

// OSC 7501 rows: programs Zotz doesn't know as agents get the chip; Claude keeps its robot.
export const programRows = defineFixture({
  width: 340,
  render: () => (
    <div className="space-y-1 bg-sidebar p-2">
      {[
        programRow('plan', 'terraform', 'terraform apply', 'working', {
          state: 'working',
          progress: 40
        }),
        programRow('deploy', 'deployctl', 'deployctl push', 'working', {
          state: 'blocked',
          kind: 'auth'
        }),
        programRow('claude', 'claude', 'Refactor the parser', 'working', {
          state: 'working',
          progress: 40
        })
      ].map((agent) => (
        <CompactAgentRow
          key={agent.paneKey}
          agent={agent}
          now={Date.UTC(2026, 10, 27, 9, 2)}
          onActivate={() => {}}
          showModel={false}
        />
      ))}
    </div>
  )
})
