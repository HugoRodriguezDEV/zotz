import type React from 'react'
import { AgentStateDot } from '@/components/AgentStateDot'
import { HostRowIcon } from '@/components/host-row-icon'
import { cn } from '@/lib/class-names'
import { ZotzAgentWithBrand } from '../agent-sprite/ZotzAgentWithBrand'
import type { ExecutionHostId } from '../../../../../shared/execution-host'
import type {
  ZotzConversationEntry,
  ZotzConversationState
} from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'

export function ZotzConversationStateMark({
  state,
  identity
}: {
  state: ZotzConversationState | null
  /** Stable conversation key so its pixel agent keeps one color. */
  identity?: string
}): React.JSX.Element {
  return <AgentStateDot state={state ?? 'idle'} identity={identity} size="md" />
}

/** One conversation in the links panel: state, short name, title, agent and, when asked, its machine. */
export function ZotzLinkConversationRow({
  entry,
  machine,
  onOpen,
  action,
  highlighted
}: {
  entry: ZotzConversationEntry
  /** Shown for partners on another machine. */
  machine?: { hostId: ExecutionHostId; name: string } | null
  onOpen: () => void
  action?: React.ReactNode
  highlighted?: boolean
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/60',
        highlighted && 'bg-accent'
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <ZotzAgentWithBrand agentType={entry.agent}>
          <ZotzConversationStateMark state={entry.state} identity={entry.shortName} />
        </ZotzAgentWithBrand>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-foreground">{entry.title}</span>
          <span className="flex min-w-0 items-center gap-1 text-2xs text-muted-foreground">
            <span className="shrink-0 font-medium text-foreground/70">{entry.shortName}</span>
            {entry.agent ? (
              <>
                <span aria-hidden>·</span>
                <span className="shrink-0">{entry.agent}</span>
              </>
            ) : null}
            {machine ? (
              <span className="ml-1 flex min-w-0 items-center gap-1 rounded border border-border px-1">
                <HostRowIcon hostId={machine.hostId} className="size-2.5 shrink-0" />
                <span className="truncate">{machine.name}</span>
              </span>
            ) : (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{entry.projectName}</span>
              </>
            )}
          </span>
        </span>
      </button>
      {action}
    </div>
  )
}
