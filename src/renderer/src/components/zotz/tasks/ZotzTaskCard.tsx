import {
  Bot,
  ExternalLink,
  FileText,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  Plug
} from 'lucide-react'
import { GitHubIcon } from '@/components/icons/GitHubIcon'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { openAppHttpLink } from '@/lib/browser/navigation/app-http-link-open'
import { chipStyle, labelChipColors } from '../../github-project/cells/project-cell-chip-colors'
import type { GitHubProjectUser } from '../../../../../shared/github/projects/project-types'
import type { ZotzTaskBoardItem } from '../../../../../shared/zotz/tasks/zotz-task-board-columns'
import { zotzTaskCardView, type ZotzTaskCardView } from './zotz-task-card-view'
import { useZotzTaskDevelopmentFor } from './use-zotz-task-development'
import { useZotzTaskWorkspaceFor } from './use-zotz-task-workspaces'
import {
  zotzLeadPullRequest,
  type ZotzPullRequestInfo
} from '../../../../../shared/zotz/tasks/zotz-task-development-types'

type Translate = ReturnType<typeof useTranslate>

/** "→ main · PR open · acme/web#534", the way Avena shows a ticket's PR. */
export function pullRequestSummary(pullRequest: ZotzPullRequestInfo, t: Translate): string {
  const ref = `${pullRequest.repo}#${pullRequest.number}`
  if (pullRequest.state === 'merged') {
    return t('zotz.taskBoard.pr.merged', 'PR merged into {{base}} · {{ref}}', {
      base: pullRequest.baseRef,
      ref
    })
  }
  if (pullRequest.state === 'closed') {
    return t('zotz.taskBoard.pr.closed', 'PR closed without merging · {{ref}}', { ref })
  }
  return pullRequest.isDraft
    ? t('zotz.taskBoard.pr.draft', '→ {{base}} · draft PR · {{ref}}', {
        base: pullRequest.baseRef,
        ref
      })
    : t('zotz.taskBoard.pr.open', '→ {{base}} · PR open · {{ref}}', {
        base: pullRequest.baseRef,
        ref
      })
}

export function PullRequestStateIcon({
  pullRequest,
  className
}: {
  pullRequest: ZotzPullRequestInfo
  className: string
}): React.JSX.Element {
  const Icon =
    pullRequest.state === 'merged'
      ? GitMerge
      : pullRequest.state === 'closed'
        ? GitPullRequestClosed
        : pullRequest.isDraft
          ? GitPullRequestDraft
          : GitPullRequest
  return <Icon className={className} />
}

function PullRequestLine({ item }: { item: ZotzTaskBoardItem }): React.JSX.Element | null {
  const t = useTranslate()
  const development = useZotzTaskDevelopmentFor(item)
  const lead = zotzLeadPullRequest(development?.linked ?? [])
  if (!lead || !development) {
    return null
  }
  const more = development.linked.length - 1
  return (
    <div className="mb-1 flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
      <PullRequestStateIcon pullRequest={lead} className="size-3 shrink-0" />
      <span className="truncate">{pullRequestSummary(lead, t)}</span>
      {more > 0 ? (
        <span className="shrink-0">
          {t('zotz.taskBoard.pr.more', '+{{total}}', { total: more })}
        </span>
      ) : null}
    </div>
  )
}

/** Hides an avatar that fails to load instead of leaving a blank gap. */
export function hideBrokenImage(event: React.SyntheticEvent<HTMLImageElement>): void {
  event.currentTarget.style.display = 'none'
}

export function openZotzTaskUrl(url: string): void {
  openAppHttpLink(url)
}

/** The source's mark: GitHub's logo, or an external service's own logo (a plug when it has none). */
export function ZotzTaskBrand({
  brand,
  className
}: {
  brand: ZotzTaskCardView['brand']
  className: string
}): React.JSX.Element {
  if (brand.kind === 'github') {
    return <GitHubIcon className={className} />
  }
  return brand.logoUrl ? (
    <img
      src={brand.logoUrl}
      alt=""
      onError={hideBrokenImage}
      className={`${className} rounded-sm`}
    />
  ) : (
    <Plug className={className} />
  )
}

export function ZotzTaskAvatars({
  users
}: {
  users: GitHubProjectUser[]
}): React.JSX.Element | null {
  if (users.length === 0) {
    return null
  }
  return (
    <div className="flex shrink-0 -space-x-1.5">
      {users.slice(0, 3).map((user) =>
        user.avatarUrl ? (
          <img
            key={user.login}
            src={user.avatarUrl}
            alt={user.login}
            title={user.login}
            className="size-4 rounded-full border border-background"
          />
        ) : (
          <span
            key={user.login}
            title={user.login}
            className="flex size-4 items-center justify-center rounded-full border border-background bg-muted text-[11px] uppercase"
          >
            {user.login.charAt(0)}
          </span>
        )
      )}
    </div>
  )
}

export const ZOTZ_TASK_DRAG_MIME = 'application/x-zotz-task'

/** The workspace working on this task and what its agent is doing; a click opens it. */
function WorkspaceChip({ item }: { item: ZotzTaskBoardItem }): React.JSX.Element | null {
  const t = useTranslate()
  const { workspace, actions } = useZotzTaskWorkspaceFor(item)
  if (!workspace || !actions) {
    return null
  }
  const label =
    workspace.agentState === 'working'
      ? t('zotz.taskBoard.agent.working', 'Agent working')
      : workspace.agentState === 'waiting' || workspace.agentState === 'blocked'
        ? t('zotz.taskBoard.agent.waiting', 'Agent waiting on you')
        : workspace.agentState === 'done'
          ? t('zotz.taskBoard.agent.done', 'Agent finished')
          : t('zotz.taskBoard.agent.workspace', 'Workspace')
  return (
    <button
      type="button"
      title={workspace.name}
      onClick={() => actions.open(workspace)}
      className="mt-1.5 flex max-w-full cursor-pointer items-center gap-1 rounded-full border border-border/60 px-1.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <Bot className="size-3 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  )
}

/** A task on the board: where it comes from, what it is, and a way out to its own site. */
export function ZotzTaskCard({
  item,
  onOpen,
  draggable = false
}: {
  item: ZotzTaskBoardItem
  onOpen: () => void
  draggable?: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const view = zotzTaskCardView(item)
  const openLabel =
    view.brand.kind === 'github'
      ? t('zotz.taskBoard.card.openInGitHub', 'Open in GitHub')
      : t('zotz.taskBoard.card.openInSource', 'Open in {{source}}', { source: view.brand.name })
  const Glyph =
    view.itemType === 'pr' ? GitPullRequest : view.itemType === 'draft' ? FileText : null
  return (
    <div
      role="listitem"
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.setData(ZOTZ_TASK_DRAG_MIME, item.key)
        event.dataTransfer.effectAllowed = 'move'
      }}
      className={cn(
        'rounded-md border border-border/60 bg-card p-2 text-card-foreground shadow-xs',
        draggable && 'cursor-grab active:cursor-grabbing'
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
        <ZotzTaskBrand brand={view.brand} className="size-3 shrink-0" />
        {view.ownerAvatarUrl ? (
          <img
            src={view.ownerAvatarUrl}
            alt=""
            onError={hideBrokenImage}
            className="size-3.5 shrink-0 rounded-sm"
          />
        ) : null}
        <span className="min-w-0 flex-1 truncate">
          {view.ownerName === view.projectTitle
            ? view.ownerName
            : `${view.ownerName} / ${view.projectTitle}`}
        </span>
        {view.url ? (
          <button
            type="button"
            aria-label={openLabel}
            title={openLabel}
            onClick={() => (view.url ? openZotzTaskUrl(view.url) : undefined)}
            className="shrink-0 cursor-pointer rounded p-0.5 hover:bg-accent hover:text-foreground"
          >
            <ExternalLink className="size-3" />
          </button>
        ) : null}
      </div>
      <div className="mt-1.5">
        <PullRequestLine item={item} />
      </div>
      <div className="flex items-start gap-1.5">
        {Glyph ? <Glyph className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /> : null}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpen}
            className="block w-full cursor-pointer text-left text-xs font-medium leading-snug hover:underline"
          >
            <span className="line-clamp-2">
              {view.itemType === 'restricted'
                ? t('zotz.taskBoard.card.restricted', 'Restricted item')
                : item.title}
            </span>
          </button>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            {view.itemType === 'draft' ? (
              <span className="shrink-0">{t('zotz.taskBoard.card.draft', 'Draft')}</span>
            ) : null}
            {view.numberLabel ? <span className="shrink-0">{view.numberLabel}</span> : null}
            {view.repository ? <span className="truncate">{view.repository}</span> : null}
          </div>
          {view.labels.length > 0 ? (
            <div className="mt-1 flex min-w-0 flex-wrap gap-1">
              {view.labels.slice(0, 2).map((label) => (
                <span
                  key={label.name}
                  className="max-w-full truncate rounded-full px-1.5 text-[11px] text-[var(--github-project-chip-fg-light)] dark:text-[var(--github-project-chip-fg-dark)]"
                  style={chipStyle(labelChipColors(label.color))}
                >
                  {label.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <ZotzTaskAvatars users={view.assignees} />
      </div>
      <WorkspaceChip item={item} />
    </div>
  )
}
