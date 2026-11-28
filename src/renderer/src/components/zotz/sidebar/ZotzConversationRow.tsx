import { HostRowIcon } from '@/components/host-row-icon'
import { selectExecutionHostDisplayLabel } from '@/runtime/hosts/display/execution-host-display-label'
import React from 'react'
import { GitPullRequest, Link2 } from 'lucide-react'
import { useNow } from '@/hooks/use-now'
import { useAppStore } from '@/store/index'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { activateAndRevealWorkspace } from '@/lib/workspace/activation/worktree-activation'
import { AgentStateDot, agentStateLabel } from '@/components/AgentStateDot'
import type { Repo } from '../../../../../shared/repository/repo-types'
import type {
  ZotzConversationRow as Row,
  ZotzConversationStatus
} from './zotz-project-conversations'
import { ZotzAgentSprite } from '../agent-sprite/ZotzAgentSprite'
import { ZotzAgentWithBrand } from '../agent-sprite/ZotzAgentWithBrand'
import { ZOTZ_WATCHING_RADAR } from '../agent-sprite/zotz-process-sprite-spec'
import { useZotzWorktreePr } from '../pr-status/use-zotz-worktree-pr'
import { ZOTZ_PR_TONE_TEXT, zotzPrStatusLabel, zotzPrTone } from '../pr-status/zotz-pr-status'
import { ZotzPrStatusIcon } from '../pr-status/ZotzPrStatusIcon'
import { minutesSince } from '../agent-queue/zotz-memory-format'
import { normalizeZotzShortName } from '../../../../../shared/zotz/zotz-short-name'
import { useZotzHostColor } from '../host-color/use-zotz-host-color'
import { ZotzHostDot } from '../host-color/ZotzHostDot'
import { formatZotzRepoSlug, useZotzRepoGitHubSlug } from '../repo-github/use-zotz-repo-github-slug'
import { formatZotzCompactAgo } from './zotz-compact-time'

function StatusMark({
  status,
  canceled,
  queued,
  identity
}: {
  status: ZotzConversationStatus | null
  canceled: boolean
  queued: boolean
  identity: string
}): React.JSX.Element {
  const t = useTranslate()
  if (queued) {
    return (
      <ZotzAgentSprite
        state="queued"
        identity={identity}
        label={t('zotz.agentQueue.queuedMark', 'Queued')}
      />
    )
  }
  if (status) {
    return (
      <AgentStateDot
        state={status.state}
        unread={status.unread}
        identity={identity}
        agentType={status.agentType}
        size="md"
        tooltipSide="right"
        zotzProcess={status.state === 'monitoring' ? ZOTZ_WATCHING_RADAR : null}
      />
    )
  }
  if (canceled) {
    return (
      <ZotzAgentSprite
        state="canceled"
        identity={identity}
        label={t('zotz.agentQueue.canceledMark', 'Canceled')}
      />
    )
  }
  return <ZotzAgentSprite state="idle" identity={identity} label={agentStateLabel('idle')} />
}

/** `+371 −28` against the branch base, once Source Control has measured it. */
function LineTotalBadge({ worktreeId }: { worktreeId: string }): React.JSX.Element | null {
  const total = useAppStore((s) => s.gitBranchLineTotalByWorktree?.[worktreeId] ?? null)
  if (!total || (total.added === 0 && total.removed === 0)) {
    return null
  }
  return (
    <span className="shrink-0 rounded-sm border border-worktree-sidebar-border px-1 font-mono text-2xs tabular-nums group-hover/conversation:invisible">
      <span className="text-zotz-gh-success">+{total.added}</span>
      {total.removed > 0 ? (
        <span className="ml-1 text-zotz-gh-danger">−{total.removed}</span>
      ) : null}
    </span>
  )
}

/** A worktree whose folder is named after its branch (`fix/login` in `login`) shows it once. */
function branchRepeatsShortName(row: Row): boolean {
  const lastSegment = row.branch?.split('/').at(-1) ?? ''
  return row.shortName !== null && normalizeZotzShortName(lastSegment) === row.shortName
}

/** Conductor-style row: title and line totals, then short name · branch · PR #N · its state (or how long ago). */
export function ZotzConversationRow({
  row,
  repo,
  active,
  status,
  canceled,
  queuedSince,
  linked = false,
  showHost = false,
  projectName = null
}: {
  row: Row
  repo: Repo | undefined
  /** The project lives on several machines, so the row names the one it runs on. */
  showHost?: boolean
  active: boolean
  status: ZotzConversationStatus | null
  /** Its only agent was canceled in the memory queue and never started. */
  canceled: boolean
  /** When its oldest agent entered the memory queue; null when none waits. */
  queuedSince: number | null
  /** Linked with other conversations to work together. */
  linked?: boolean
  /** Shown in a group, where rows from several projects sit together. */
  projectName?: string | null
}): React.JSX.Element {
  const t = useTranslate()
  const now = useNow(30_000, queuedSince !== null)
  const pr = useZotzWorktreePr(row.worktree, repo)
  const prTone = pr ? zotzPrTone(pr.status) : null
  const lastActivity = row.worktree?.lastActivityAt ?? 0
  const showBranch = row.branch !== null && row.branch !== row.title && !branchRepeatsShortName(row)
  const hostLabel = useAppStore((s) =>
    showHost ? selectExecutionHostDisplayLabel(s, row.hostId) : null
  )
  const hostColor = useZotzHostColor(hostLabel ? row.hostId : null)
  const slug = useZotzRepoGitHubSlug(projectName ? repo : undefined)
  const hasLeading =
    showBranch || row.shortName !== null || hostLabel !== null || projectName !== null
  return (
    <button
      type="button"
      data-current={active ? 'true' : undefined}
      aria-current={active ? 'page' : undefined}
      onClick={() => activateAndRevealWorkspace(row.id)}
      className={cn(
        'flex w-full min-w-0 items-start gap-2 py-1.5 pr-2 pl-6 text-left transition-colors',
        active
          ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground shadow-[inset_2px_0_0_currentColor]'
          : 'text-worktree-sidebar-foreground/80 hover:bg-worktree-sidebar-foreground/8'
      )}
    >
      <ZotzAgentWithBrand agentType={status?.agentType}>
        <StatusMark
          status={status}
          canceled={canceled}
          queued={queuedSince !== null}
          identity={row.shortName ?? row.id}
        />
      </ZotzAgentWithBrand>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{row.title}</span>
          {linked ? (
            <Link2
              role="img"
              aria-label={t('zotz.links.linkedMark', 'Linked')}
              className="size-3 shrink-0 text-worktree-sidebar-foreground/60"
            />
          ) : null}
          {row.worktree ? <LineTotalBadge worktreeId={row.worktree.id} /> : null}
        </span>
        <span className="flex min-w-0 items-center gap-1 overflow-hidden font-zotz-data text-xs tracking-normal text-worktree-sidebar-foreground/50">
          {hostLabel ? (
            <span className="flex max-w-[45%] shrink-0 items-center gap-1 rounded border border-worktree-sidebar-border px-1 font-medium text-worktree-sidebar-foreground/70">
              {hostColor ? (
                <ZotzHostDot color={hostColor} className="size-1.5" />
              ) : (
                <HostRowIcon hostId={row.hostId} className="size-2.5 shrink-0" />
              )}
              <span className="truncate">{hostLabel}</span>
            </span>
          ) : null}
          {row.shortName ? (
            <span className="max-w-[13ch] min-w-8 truncate font-medium text-worktree-sidebar-foreground/70">
              {row.shortName}
            </span>
          ) : null}
          {projectName ? (
            <>
              {row.shortName || hostLabel ? <span aria-hidden>·</span> : null}
              {/* In a group the GitHub repository says which project it is; the folder name may not. */}
              <span
                className="max-w-[45%] min-w-[3ch] shrink-[100] truncate"
                title={slug ? formatZotzRepoSlug(slug) : undefined}
              >
                {slug?.repo ?? projectName}
              </span>
            </>
          ) : null}
          {showBranch ? (
            <>
              {row.shortName || hostLabel || projectName ? <span aria-hidden>·</span> : null}
              <span className="min-w-[3ch] shrink-[100] truncate">{row.branch}</span>
            </>
          ) : null}
          {queuedSince !== null ? (
            <>
              {hasLeading ? <span aria-hidden>·</span> : null}
              <span className="shrink-0 font-medium text-zotz-gh-pending">
                {t('zotz.agentQueue.queuedFor', 'Queued · {{minutes}} min', {
                  minutes: minutesSince(queuedSince, now)
                })}
              </span>
            </>
          ) : pr && prTone ? (
            <>
              {hasLeading ? <span aria-hidden>·</span> : null}
              <GitPullRequest className="size-3 shrink-0" />
              <span className="shrink-0">#{pr.pr.number}</span>
              <span aria-hidden>·</span>
              <ZotzPrStatusIcon status={pr.status} className="size-3" />
              <span className={cn('shrink-0 font-medium', ZOTZ_PR_TONE_TEXT[prTone])}>
                {zotzPrStatusLabel(pr.status, t)}
              </span>
            </>
          ) : lastActivity > 0 ? (
            <>
              {hasLeading ? <span aria-hidden>·</span> : null}
              <span className="shrink-0">{formatZotzCompactAgo(lastActivity)}</span>
            </>
          ) : null}
        </span>
      </span>
    </button>
  )
}
