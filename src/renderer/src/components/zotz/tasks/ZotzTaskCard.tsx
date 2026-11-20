import { ExternalLink, FileText, GitPullRequest } from 'lucide-react'
import { GitHubIcon } from '@/components/icons/GitHubIcon'
import { useTranslate } from '@/i18n/use-translate'
import { chipStyle, labelChipColors } from '../../github-project/cells/project-cell-chip-colors'
import type { GitHubProjectUser } from '../../../../../shared/github/projects/project-types'
import type { ZotzTaskBoardItem } from '../../../../../shared/zotz/tasks/zotz-task-board-columns'

/** Hides an avatar that fails to load instead of leaving a blank gap. */
export function hideBrokenImage(event: React.SyntheticEvent<HTMLImageElement>): void {
  event.currentTarget.style.display = 'none'
}

/** GitHub serves every account's avatar at /<login>.png, so owners need no extra API call. */
export function githubOwnerAvatarUrl(owner: string, host?: string): string {
  return `https://${host ?? 'github.com'}/${encodeURIComponent(owner)}.png?size=40`
}

export function openZotzTaskUrl(url: string): void {
  void window.api.shell.openUrl(url)
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

/** A task on the combined board: where it comes from, what it is, and a way out to GitHub. */
export function ZotzTaskCard({
  item,
  onOpen
}: {
  item: ZotzTaskBoardItem
  onOpen: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const { row, project } = item
  const url = row.content.url ?? project.url
  const Glyph =
    row.itemType === 'PULL_REQUEST'
      ? GitPullRequest
      : row.itemType === 'DRAFT_ISSUE'
        ? FileText
        : null
  return (
    <div
      role="listitem"
      className="rounded-md border border-border/60 bg-card p-2 text-card-foreground shadow-xs"
    >
      <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
        <GitHubIcon className="size-3 shrink-0" />
        <img
          src={githubOwnerAvatarUrl(project.owner, project.host)}
          alt=""
          onError={hideBrokenImage}
          className="size-3.5 shrink-0 rounded-sm"
        />
        <span className="min-w-0 flex-1 truncate">
          {project.owner} / {project.title}
        </span>
        <button
          type="button"
          aria-label={t('zotz.taskBoard.card.openInGitHub', 'Open in GitHub')}
          title={t('zotz.taskBoard.card.openInGitHub', 'Open in GitHub')}
          onClick={() => openZotzTaskUrl(url)}
          className="shrink-0 cursor-pointer rounded p-0.5 hover:bg-accent hover:text-foreground"
        >
          <ExternalLink className="size-3" />
        </button>
      </div>
      <div className="mt-1.5 flex items-start gap-1.5">
        {Glyph ? <Glyph className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /> : null}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpen}
            className="block w-full cursor-pointer text-left text-xs font-medium leading-snug hover:underline"
          >
            <span className="line-clamp-2">
              {row.itemType === 'REDACTED'
                ? t('zotz.taskBoard.card.restricted', 'Restricted item')
                : row.content.title}
            </span>
          </button>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            {row.itemType === 'DRAFT_ISSUE' ? (
              <span className="shrink-0">{t('zotz.taskBoard.card.draft', 'Draft')}</span>
            ) : null}
            {row.content.number == null ? null : (
              <span className="shrink-0">#{row.content.number}</span>
            )}
            {row.content.repository ? (
              <span className="truncate">{row.content.repository}</span>
            ) : null}
          </div>
          {row.content.labels.length > 0 ? (
            <div className="mt-1 flex min-w-0 flex-wrap gap-1">
              {row.content.labels.slice(0, 2).map((label) => (
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
        <ZotzTaskAvatars users={row.content.assignees} />
      </div>
    </div>
  )
}
