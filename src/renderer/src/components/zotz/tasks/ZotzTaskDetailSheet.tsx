import { Bot, ExternalLink } from 'lucide-react'
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
  GitHubProjectTable
} from '../../../../../shared/github/projects/project-types'
import type { ZotzTaskBoardItem } from '../../../../../shared/zotz/tasks/zotz-task-board-columns'
import { hideBrokenImage, openZotzTaskUrl, ZotzTaskAvatars, ZotzTaskBrand } from './ZotzTaskCard'
import { zotzTaskCardView } from './zotz-task-card-view'
import { ZotzTaskDevelopmentSection } from './ZotzTaskDevelopmentSection'
import { useZotzTaskWorkspaceFor } from './use-zotz-task-workspaces'

export type ZotzTaskDetail = {
  item: ZotzTaskBoardItem
  /** The GitHub project table, for its field names; absent for external tasks. */
  table?: GitHubProjectTable
}

type Translate = ReturnType<typeof useTranslate>

function githubFieldText(value: GitHubProjectFieldValue): string {
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

/** The task's own fields, in its source's order; built-ins like title are shown above. */
function fieldRows(detail: ZotzTaskDetail): { name: string; value: string }[] {
  const { origin } = detail.item
  if (origin.kind === 'external') {
    return origin.source.document.source.fields.flatMap((field) => {
      const value = origin.task.fieldValues[field.name]
      if (value === undefined || value === null || value === '') {
        return []
      }
      const text =
        field.type === 'single-select'
          ? (field.options.find((option) => option.id === value)?.name ?? String(value))
          : field.type === 'iteration'
            ? (field.iterations.find((iteration) => iteration.id === value)?.title ?? String(value))
            : String(value)
      return [{ name: field.name, value: text }]
    })
  }
  const names = new Map(detail.table?.selectedView.fields.map((field) => [field.id, field.name]))
  return Object.values(origin.row.fieldValuesByFieldId).flatMap((value) => {
    if (value.kind === 'labels' || value.kind === 'users') {
      return []
    }
    const name = names.get(value.fieldId) ?? ('fieldName' in value ? value.fieldName : undefined)
    const text = githubFieldText(value)
    return name && text && name.toLowerCase() !== 'title' ? [{ name, value: text }] : []
  })
}

function stateLabel(state: string | null | undefined, t: Translate): string | null {
  switch ((state ?? '').toUpperCase()) {
    case 'OPEN':
      return t('zotz.taskBoard.state.open', 'Open')
    case 'CLOSED':
      return t('zotz.taskBoard.state.closed', 'Closed')
    case 'MERGED':
      return t('zotz.taskBoard.state.merged', 'Merged')
    default:
      return state ?? null
  }
}

/** Opens the task's workspace, or starts one from the task with its id in the branch. */
function TaskWorkspaceAction({ item }: { item: ZotzTaskBoardItem }): React.JSX.Element | null {
  const t = useTranslate()
  const { workspace, actions } = useZotzTaskWorkspaceFor(item)
  if (!actions) {
    return null
  }
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => (workspace ? actions.open(workspace) : actions.create(item))}
    >
      <Bot className="size-3.5" />
      {workspace
        ? t('zotz.taskBoard.agent.openWorkspace', 'Open workspace')
        : t('zotz.taskBoard.agent.createWorkspace', 'Create workspace with this task')}
    </Button>
  )
}

/** Read-only view of a task as its source shows it; editing happens there. */
export function ZotzTaskDetailSheet({
  detail,
  onClose,
  onLinkPullRequest
}: {
  detail: ZotzTaskDetail | null
  onClose: () => void
  onLinkPullRequest: (item: ZotzTaskBoardItem, url: string) => void
}): React.JSX.Element {
  const t = useTranslate()
  const view = detail ? zotzTaskCardView(detail.item) : null
  const origin = detail?.item.origin
  const state = origin?.kind === 'github' ? origin.row.content.state : origin?.task.state
  const body = origin?.kind === 'github' ? origin.row.content.body : origin?.task.body
  const parentIssue = origin?.kind === 'github' ? origin.row.content.parentIssue : null
  const subIssues = origin?.kind === 'github' ? origin.row.content.subIssuesProgress : null
  return (
    <Sheet open={detail !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {detail && view ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ZotzTaskBrand brand={view.brand} className="size-3.5" />
                {view.ownerAvatarUrl ? (
                  <img
                    src={view.ownerAvatarUrl}
                    alt=""
                    onError={hideBrokenImage}
                    className="size-4 rounded-sm"
                  />
                ) : null}
                <span className="truncate">
                  {view.ownerName === view.projectTitle
                    ? view.ownerName
                    : `${view.ownerName} / ${view.projectTitle}`}
                </span>
              </div>
              <SheetTitle>{detail.item.title}</SheetTitle>
              <SheetDescription>
                {[view.repository, view.numberLabel, stateLabel(state, t)]
                  .filter(Boolean)
                  .join(' · ')}
              </SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 text-sm scrollbar-sleek">
              <div className="flex flex-wrap gap-2">
                {view.url ? (
                  <Button
                    type="button"

                    onClick={() => (view.url ? openZotzTaskUrl(view.url) : undefined)}
                  >
                    <ExternalLink className="size-3.5" />
                    {view.brand.kind === 'github'
                      ? t('zotz.taskBoard.detail.openInGitHub', 'Open in GitHub')
                      : t('zotz.taskBoard.card.openInSource', 'Open in {{source}}', {
                          source: view.brand.name
                        })}
                  </Button>
                ) : null}
                <TaskWorkspaceAction item={detail.item} />
              </div>

              <dl className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
                {view.assignees.length > 0 ? (
                  <>
                    <dt className="text-muted-foreground">
                      {t('zotz.taskBoard.detail.assignees', 'Assignees')}
                    </dt>
                    <dd className="flex min-w-0 items-center gap-2">
                      <ZotzTaskAvatars users={view.assignees} />
                      <span className="truncate">
                        {view.assignees.map((user) => user.name ?? user.login).join(', ')}
                      </span>
                    </dd>
                  </>
                ) : null}
                {view.labels.length > 0 ? (
                  <>
                    <dt className="text-muted-foreground">
                      {t('zotz.taskBoard.detail.labels', 'Labels')}
                    </dt>
                    <dd className="min-w-0 break-words">
                      {view.labels.map((label) => label.name).join(', ')}
                    </dd>
                  </>
                ) : null}
                {parentIssue ? (
                  <>
                    <dt className="text-muted-foreground">
                      {t('zotz.taskBoard.detail.parent', 'Parent issue')}
                    </dt>
                    <dd className="min-w-0 truncate">
                      #{parentIssue.number} {parentIssue.title}
                    </dd>
                  </>
                ) : null}
                {subIssues && subIssues.total > 0 ? (
                  <>
                    <dt className="text-muted-foreground">
                      {t('zotz.taskBoard.detail.subIssues', 'Sub-issues')}
                    </dt>
                    <dd>
                      {subIssues.completed} / {subIssues.total}
                    </dd>
                  </>
                ) : null}
                {fieldRows(detail).map((field) => (
                  <div key={field.name} className="contents">
                    <dt className="truncate text-muted-foreground">{field.name}</dt>
                    <dd className="min-w-0 break-words">{field.value}</dd>
                  </div>
                ))}
              </dl>

              <ZotzTaskDevelopmentSection
                item={detail.item}
                onLinkPullRequest={onLinkPullRequest}
              />

              {body ? (
                <p className="whitespace-pre-wrap text-xs text-muted-foreground">{body}</p>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
