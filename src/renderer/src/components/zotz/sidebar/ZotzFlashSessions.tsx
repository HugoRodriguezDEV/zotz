import React, { useMemo, useState } from 'react'
import { Radar, SquareTerminal, Workflow } from 'lucide-react'
import { useNow } from '@/hooks/use-now'
import { useAppStore } from '@/store/index'
import { useTranslate } from '@/i18n/use-translate'
import { AgentStateDot } from '@/components/AgentStateDot'
import { agentChildRowText } from '@/components/agent-child-row-text'
import type { DashboardAgentRow } from '@/components/dashboard/rows/dashboard-agent-row'
import { useWorktreeAgentRows } from '@/components/sidebar/workspace-card/activity/useWorktreeAgentRows'
import { buildSubagentChildRows } from '@/components/sidebar/workspace-card/activity/worktree-subagent-child-rows'
import { activateWorktreeAgentPane } from '@/components/sidebar/workspace-card/activity/use-worktree-agent-activation'
import { viewClaudeAgentFromRow } from '@/lib/agent-session/navigation/claude-agent-row-view'
import type { AgentChildWorkKind } from '../../../../../shared/agent-status/child-work/agent-status-child-work'
import {
  AGENT_STATUS_STALE_AFTER_MS,
  isAgentStatusFresh
} from '../../../../../shared/agent-status/contracts/agent-status-freshness'
import type { ExecutionHostId } from '../../../../../shared/execution-host'

// Listed here: the kinds' module pulls node-only code into the web bundle.
const ALL_KINDS: ReadonlySet<AgentChildWorkKind> = new Set<AgentChildWorkKind>([
  'agent',
  'workflow',
  'command',
  'monitor',
  'unknown'
])
const SHOWN_BEFORE_MORE = 4

/** Running subagents, workflows, commands and monitors of every agent in a conversation. */
function useZotzFlashSessions(
  workspaceId: string,
  hostId: ExecutionHostId
): { sessions: DashboardAgentRow[]; now: number } {
  const rows = useWorktreeAgentRows(workspaceId, true, hostId)
  const now = useNow(30_000, rows.length > 0)
  const sessions = useMemo(
    () =>
      rows.flatMap((row) =>
        row.rowSource === 'live'
          ? buildSubagentChildRows({
              parentEntry: row.entry,
              tab: row.tab,
              parentIsFresh: isAgentStatusFresh(row.entry, now, AGENT_STATUS_STALE_AFTER_MS),
              kinds: ALL_KINDS
            })
          : []
      ),
    [rows, now]
  )
  return { sessions, now }
}

/** A subagent opens in its chat or Claude pane; other work lives in the Background panel. */
function openFlashSession(
  session: DashboardAgentRow,
  workspaceId: string,
  hostId: ExecutionHostId
): void {
  activateWorktreeAgentPane(
    workspaceId,
    session.tab.id,
    session.activationPaneKey ?? session.paneKey,
    hostId
  )
  if (session.childRow?.kind === 'agent') {
    void viewClaudeAgentFromRow(session)
    return
  }
  const store = useAppStore.getState()
  store.setRightSidebarTab('zotz-background')
  store.setRightSidebarOpen(true)
}

function KindMark({ session }: { session: DashboardAgentRow }): React.JSX.Element {
  const kind = session.childRow?.kind
  const icon = 'size-3 shrink-0 text-zotz-working-wave'
  if (kind === 'command') {
    return <SquareTerminal aria-hidden className={icon} />
  }
  if (kind === 'monitor') {
    return <Radar aria-hidden className={icon} />
  }
  if (kind === 'workflow') {
    return <Workflow aria-hidden className={icon} />
  }
  return (
    <AgentStateDot
      state={session.childRow?.displayState ?? 'working'}
      identity={session.childRow?.id ?? session.paneKey}
      agentType={session.agentType}
      title={null}
    />
  )
}

/** Short-lived work hanging under its conversation while it runs, gone when it ends. */
export function ZotzFlashSessions({
  workspaceId,
  hostId
}: {
  workspaceId: string
  hostId: ExecutionHostId
}): React.JSX.Element | null {
  const t = useTranslate()
  const { sessions, now } = useZotzFlashSessions(workspaceId, hostId)
  const [expanded, setExpanded] = useState(false)
  if (sessions.length === 0) {
    return null
  }
  const shown = expanded ? sessions : sessions.slice(0, SHOWN_BEFORE_MORE)
  const hidden = sessions.length - shown.length
  return (
    <div className="ml-5 border-l border-dashed border-worktree-sidebar-border pl-1">
      {shown.map((session) => {
        const text = session.childRow
          ? agentChildRowText(session.childRow, now)
          : { lead: '', trail: '' }
        return (
          <button
            key={session.paneKey}
            type="button"
            title={text.trail ? `${text.lead} · ${text.trail}` : text.lead}
            onClick={() => openFlashSession(session, workspaceId, hostId)}
            className="flex w-full min-w-0 items-center gap-1.5 rounded-md py-0.5 pr-2 pl-1 text-left text-2xs text-worktree-sidebar-foreground/70 transition-colors hover:bg-worktree-sidebar-foreground/8"
          >
            <span className="flex w-6 shrink-0 justify-center">
              <KindMark session={session} />
            </span>
            <span className="min-w-0 shrink truncate font-medium">{text.lead}</span>
            {text.trail ? (
              <span className="min-w-0 flex-1 truncate text-worktree-sidebar-foreground/50">
                {text.trail}
              </span>
            ) : null}
          </button>
        )
      })}
      {sessions.length > SHOWN_BEFORE_MORE ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="rounded-md py-0.5 pr-2 pl-8.5 text-left text-2xs text-worktree-sidebar-foreground/50 hover:text-worktree-sidebar-foreground/80"
        >
          {expanded
            ? t('zotz.flashSessions.less', 'Show fewer')
            : t('zotz.flashSessions.more', '+{{count}} more', { count: hidden })}
        </button>
      ) : null}
    </div>
  )
}
