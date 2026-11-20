import { ExternalLink, GitPullRequest } from 'lucide-react'
import { GitHubIcon } from '@/components/icons/GitHubIcon'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { useTranslate } from '@/i18n/use-translate'
import type {
  GitHubProjectFieldValue,
  GitHubProjectRow,
  GitHubProjectTable
} from '../../../../../shared/github/projects/project-types'
import {
  githubOwnerAvatarUrl,
  hideBrokenImage,
  openZotzTaskUrl,
  ZotzTaskAvatars
} from './ZotzTaskCard'

export type ZotzTaskDetail = {
  row: GitHubProjectRow
  table: GitHubProjectTable
}

function fieldValueText(value: GitHubProjectFieldValue): string {
  switch (value.kind) {
    case 'single-select':
      return value.name
    case 'iteration':
      return value.title
    case 'text':
      return value.text
    case 'number':
      return String(value.number)
    case 'date':
      return value.date
    case 'labels':
      return value.labels.map((label) => label.name).join(', ')
    case 'users':
      return value.users.map((user) => user.login).join(', ')
  }
}

function fieldValueName(value: GitHubProjectFieldValue): string | undefined {
  return 'fieldName' in value ? value.fieldName : undefined
}

/** The project's fields for this item, in the view's field order; title and built-ins are shown above. */
function projectFieldRows(detail: ZotzTaskDetail): { name: string; value: string }[] {
  const names = new Map(detail.table.selectedView.fields.map((field) => [field.id, field.name]))
  const rows: { name: string; value: string }[] = []
  for (const value of Object.values(detail.row.fieldValuesByFieldId)) {
    if (value.kind === 'labels' || value.kind === 'users') {
      continue
    }
    const name = names.get(value.fieldId) ?? fieldValueName(value)
    const text = fieldValueText(value)
    if (name && text && name.toLowerCase() !== 'title') {
      rows.push({ name, value: text })
    }
  }
  return rows
}

function stateLabel(state: string | null, t: ReturnType<typeof useTranslate>): string | null {
  switch ((state ?? '').toUpperCase()) {
    case 'OPEN':
      return t('zotz.taskBoard.state.open', 'Open')
    case 'CLOSED':
      return t('zotz.taskBoard.state.closed', 'Closed')
    case 'MERGED':
      return t('zotz.taskBoard.state.merged', 'Merged')
    default:
      return state
  }
}

/** Read-only view of a task as its GitHub Project shows it; editing happens on GitHub. */
export function ZotzTaskDetailSheet({
  detail,
  onClose
}: {
  detail: ZotzTaskDetail | null
  onClose: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const row = detail?.row
  const project = detail?.table.project
  return (
    <Sheet open={detail !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {detail && row && project ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <GitHubIcon className="size-3.5" />
                <img
                  src={githubOwnerAvatarUrl(project.owner, project.host)}
                  alt=""
                  onError={hideBrokenImage}
                  className="size-4 rounded-sm"
                />
                <span className="truncate">
                  {project.owner} / {project.title}
                </span>
              </div>
              <SheetTitle>{row.content.title}</SheetTitle>
              <SheetDescription>
                {[
                  row.content.repository,
                  row.content.number == null ? null : `#${row.content.number}`,
                  stateLabel(row.content.state, t)
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 text-sm scrollbar-sleek">
              <Button
                type="button"
                className="self-start"
                onClick={() => openZotzTaskUrl(row.content.url ?? project.url)}
              >
                <ExternalLink className="size-3.5" />
                {t('zotz.taskBoard.detail.openInGitHub', 'Open in GitHub')}
              </Button>

              <dl className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
                {row.content.assignees.length > 0 ? (
                  <>
                    <dt className="text-muted-foreground">
                      {t('zotz.taskBoard.detail.assignees', 'Assignees')}
                    </dt>
                    <dd className="flex min-w-0 items-center gap-2">
                      <ZotzTaskAvatars users={row.content.assignees} />
                      <span className="truncate">
                        {row.content.assignees.map((user) => user.login).join(', ')}
                      </span>
                    </dd>
                  </>
                ) : null}
                {row.content.labels.length > 0 ? (
                  <>
                    <dt className="text-muted-foreground">
                      {t('zotz.taskBoard.detail.labels', 'Labels')}
                    </dt>
                    <dd className="min-w-0 break-words">
                      {row.content.labels.map((label) => label.name).join(', ')}
                    </dd>
                  </>
                ) : null}
                {row.content.parentIssue ? (
                  <>
                    <dt className="text-muted-foreground">
                      {t('zotz.taskBoard.detail.parent', 'Parent issue')}
                    </dt>
                    <dd className="min-w-0 truncate">
                      #{row.content.parentIssue.number} {row.content.parentIssue.title}
                    </dd>
                  </>
                ) : null}
                {row.content.subIssuesProgress && row.content.subIssuesProgress.total > 0 ? (
                  <>
                    <dt className="text-muted-foreground">
                      {t('zotz.taskBoard.detail.subIssues', 'Sub-issues')}
                    </dt>
                    <dd>
                      {row.content.subIssuesProgress.completed} /{' '}
                      {row.content.subIssuesProgress.total}
                    </dd>
                  </>
                ) : null}
                {projectFieldRows(detail).map((field) => (
                  <div key={field.name} className="contents">
                    <dt className="truncate text-muted-foreground">{field.name}</dt>
                    <dd className="min-w-0 break-words">{field.value}</dd>
                  </div>
                ))}
              </dl>

              {row.content.linkedPullRequests &&
              row.content.linkedPullRequests.pullRequests.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('zotz.taskBoard.detail.linkedPullRequests', 'Linked pull requests')}
                  </p>
                  {row.content.linkedPullRequests.pullRequests.map((pullRequest) => (
                    <button
                      key={pullRequest.url}
                      type="button"
                      onClick={() => openZotzTaskUrl(pullRequest.url)}
                      className="flex min-w-0 cursor-pointer items-center gap-1.5 text-left text-xs hover:underline"
                    >
                      <GitPullRequest className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="shrink-0 text-muted-foreground">#{pullRequest.number}</span>
                      <span className="truncate">{pullRequest.title}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {row.content.body ? (
                <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                  {row.content.body}
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
