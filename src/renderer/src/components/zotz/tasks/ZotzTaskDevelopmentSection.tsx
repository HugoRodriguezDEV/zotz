import { GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import type { ZotzTaskBoardItem } from '../../../../../shared/zotz/tasks/zotz-task-board-columns'
import type { ZotzPullRequestInfo } from '../../../../../shared/zotz/tasks/zotz-task-development-types'
import { openZotzTaskUrl, pullRequestSummary, PullRequestStateIcon } from './ZotzTaskCard'
import { useZotzTaskDevelopmentFor } from './use-zotz-task-development'

function commitUrl(pullRequest: ZotzPullRequestInfo, oid: string): string {
  return `${pullRequest.url.replace(/\/pull\/\d+$/, '')}/commit/${oid}`
}

function PullRequestRow({
  pullRequest,
  action
}: {
  pullRequest: ZotzPullRequestInfo
  action?: React.ReactNode
}): React.JSX.Element {
  const t = useTranslate()
  const hidden = pullRequest.changedFiles - pullRequest.files.length
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border/60 px-2.5 py-2 text-xs">
      <div className="flex min-w-0 items-start gap-1.5">
        <PullRequestStateIcon pullRequest={pullRequest} className="mt-0.5 size-3.5 shrink-0" />
        <button
          type="button"
          onClick={() => openZotzTaskUrl(pullRequest.url)}
          className="min-w-0 flex-1 cursor-pointer text-left font-medium hover:underline"
        >
          {pullRequest.title}
        </button>
        {action}
      </div>
      <p className="text-muted-foreground">{pullRequestSummary(pullRequest, t)}</p>
      <p className="text-muted-foreground">
        {[
          pullRequest.author ? `@${pullRequest.author}` : null,
          `+${pullRequest.additions} −${pullRequest.deletions}`,
          t('zotz.taskBoard.dev.files', '{{total}} files', { total: pullRequest.changedFiles })
        ]
          .filter(Boolean)
          .join(' · ')}
        {pullRequest.mergeCommit ? (
          <>
            {' · '}
            <button
              type="button"
              className="cursor-pointer font-mono hover:underline"
              onClick={() =>
                pullRequest.mergeCommit
                  ? openZotzTaskUrl(commitUrl(pullRequest, pullRequest.mergeCommit.oid))
                  : undefined
              }
            >
              {pullRequest.mergeCommit.abbreviatedOid}
            </button>
          </>
        ) : null}
      </p>
      {pullRequest.files.length > 0 ? (
        <ul className="truncate font-mono text-[11px] text-muted-foreground">
          {pullRequest.files.map((path) => (
            <li key={path} className="truncate">
              {path}
            </li>
          ))}
          {hidden > 0 ? (
            <li>{t('zotz.taskBoard.dev.moreFiles', 'and {{total}} more', { total: hidden })}</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}

/** Like GitHub's "Development" box: linked PRs and branches, plus PRs that only mention the task. */
export function ZotzTaskDevelopmentSection({
  item,
  onLinkPullRequest
}: {
  item: ZotzTaskBoardItem
  onLinkPullRequest: (item: ZotzTaskBoardItem, url: string) => void
}): React.JSX.Element | null {
  const t = useTranslate()
  const locale = useIntlLocale()
  const development = useZotzTaskDevelopmentFor(item)
  if (!development) {
    return item.origin.kind === 'github' && item.origin.row.itemType === 'ISSUE' ? (
      <p className="text-xs text-muted-foreground">
        {t('zotz.taskBoard.dev.unverified', 'Not verified on GitHub yet')}
      </p>
    ) : null
  }
  const empty =
    development.linked.length === 0 &&
    development.mentioned.length === 0 &&
    development.branches.length === 0
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">
        {t('zotz.taskBoard.dev.title', 'Development')}
      </p>
      {empty ? (
        <p className="text-xs text-muted-foreground">
          {t('zotz.taskBoard.dev.empty', 'No pull requests or branches yet.')}
        </p>
      ) : null}
      {development.linked.map((pullRequest) => (
        <PullRequestRow key={pullRequest.url} pullRequest={pullRequest} />
      ))}
      {development.branches.map((branch) => (
        <p
          key={branch}
          className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground"
        >
          <GitBranch className="size-3.5" />
          {branch}
        </p>
      ))}
      {development.mentioned.length > 0 ? (
        <>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            {t('zotz.taskBoard.dev.mentioned', 'Mentioned (not linked)')}
          </p>
          {development.mentioned.map((pullRequest) => (
            <PullRequestRow
              key={pullRequest.url}
              pullRequest={pullRequest}
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    item.origin.kind === 'github'
                      ? openZotzTaskUrl(pullRequest.url)
                      : onLinkPullRequest(item, pullRequest.url)
                  }
                >
                  {item.origin.kind === 'github'
                    ? t('zotz.taskBoard.dev.linkOnGitHub', 'Link on GitHub')
                    : t('zotz.taskBoard.dev.link', 'Link')}
                </Button>
              }
            />
          ))}
        </>
      ) : null}
      {development.verifiedAt > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {t('zotz.taskBoard.dev.verifiedAt', 'Checked on GitHub at {{time}}', {
            time: new Date(development.verifiedAt).toLocaleTimeString(locale, {
              hour: '2-digit',
              minute: '2-digit'
            })
          })}
        </p>
      ) : null}
    </div>
  )
}
