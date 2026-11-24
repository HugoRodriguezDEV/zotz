import React from 'react'
import { useAppStore } from '@/store/index'
import { selectExecutionHostDisplayLabel } from '@/runtime/hosts/display/execution-host-display-label'
import type { ExecutionHostId } from '../../../../../shared/execution-host'
import type { ZotzConversationRow } from './zotz-project-conversations'
import { splitZotzRowsByHost } from './zotz-host-subgroups'
import { ZotzHostDot } from '../host-color/ZotzHostDot'

function MachineHeader({
  hostId,
  color
}: {
  hostId: ExecutionHostId
  color: string
}): React.JSX.Element {
  const label = useAppStore((state) => selectExecutionHostDisplayLabel(state, hostId))
  return (
    <div
      data-zotz-machine-subgroup={hostId}
      className="flex min-w-0 items-center gap-1.5 pt-1.5 pr-2 pb-0.5 pl-[30px] text-2xs font-medium text-worktree-sidebar-foreground/70"
    >
      <ZotzHostDot color={color} />
      <span className="truncate">{label}</span>
    </div>
  )
}

/** A project's conversations: this machine's first, then one labeled, colored list per other machine. */
export function ZotzMachineSubgroups({
  rows,
  colorOf,
  render
}: {
  rows: readonly ZotzConversationRow[]
  colorOf: (hostId: ExecutionHostId) => string | null
  render: (row: ZotzConversationRow) => React.ReactNode
}): React.JSX.Element {
  const { here, machines } = splitZotzRowsByHost(rows, (hostId) => colorOf(hostId) !== null)
  return (
    <>
      {here.map(render)}
      {machines.map(({ hostId, conversations }) => {
        const color = colorOf(hostId) ?? 'transparent'
        return (
          <div key={hostId} className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute top-1.5 bottom-1 left-3.5 w-0.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <MachineHeader hostId={hostId} color={color} />
            {conversations.map(render)}
          </div>
        )
      })}
    </>
  )
}
