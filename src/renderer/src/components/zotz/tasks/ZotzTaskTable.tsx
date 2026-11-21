import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import type { ZotzTaskBoardItem } from '../../../../../shared/zotz/tasks/zotz-task-board-columns'
import { zotzLeadPullRequest } from '../../../../../shared/zotz/tasks/zotz-task-development-types'
import type { ZotzTaskFacts } from '../../../../../shared/zotz/tasks/zotz-task-filter'
import type { ZotzTaskGroup } from '../../../../../shared/zotz/tasks/zotz-task-board-views'
import { zotzTaskFieldKey } from '../../../../../shared/zotz/tasks/zotz-task-fields'
import { pullRequestSummary, ZotzTaskAvatars, ZotzTaskBrand } from './ZotzTaskCard'
import { zotzTaskCardView } from './zotz-task-card-view'
import { useZotzTaskDevelopmentFor } from './use-zotz-task-development'
import type { ZotzTaskSummarize } from './use-zotz-task-sum'

function Row({
  item,
  facts,
  sumField,
  onOpen
}: {
  item: ZotzTaskBoardItem
  facts: ZotzTaskFacts | undefined
  sumField: string | null
  onOpen: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const locale = useIntlLocale()
  const view = zotzTaskCardView(item)
  const lead = zotzLeadPullRequest(useZotzTaskDevelopmentFor(item)?.linked ?? [])
  const sumValue = sumField ? facts?.fields[zotzTaskFieldKey(sumField)]?.value : undefined
  return (
    <tr className="border-b border-border/50 hover:bg-accent/40">
      <td className="max-w-80 py-1.5 pr-3">
        <button
          type="button"
          onClick={onOpen}
          className="block w-full cursor-pointer truncate text-left font-medium hover:underline"
        >
          {item.title}
        </button>
        <span className="text-muted-foreground">
          {[view.numberLabel, view.repository].filter(Boolean).join(' · ')}
        </span>
      </td>
      <td className="py-1.5 pr-3">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <ZotzTaskBrand brand={view.brand} className="size-3 shrink-0" />
          <span className="truncate">{view.projectTitle}</span>
        </span>
      </td>
      <td className="py-1.5 pr-3">{item.statusName ?? '—'}</td>
      <td className="py-1.5 pr-3">
        <ZotzTaskAvatars users={view.assignees} />
      </td>
      <td className="max-w-40 truncate py-1.5 pr-3 text-muted-foreground">
        {view.labels.map((label) => label.name).join(', ')}
      </td>
      <td className="max-w-56 truncate py-1.5 pr-3 text-muted-foreground">
        {lead ? pullRequestSummary(lead, t) : ''}
      </td>
      {sumField ? (
        <td className="py-1.5 pr-3 text-right tabular-nums">
          {sumValue?.type === 'number' ? sumValue.number.toLocaleString(locale) : ''}
        </td>
      ) : null}
      <td className="whitespace-nowrap py-1.5 text-muted-foreground">
        {facts?.updatedAt ? new Date(facts.updatedAt).toLocaleDateString(locale) : ''}
      </td>
    </tr>
  )
}

/** The table layout; groups become header rows, like a grouped GitHub table view. */
export function ZotzTaskTable({
  groups,
  facts,
  sumField,
  summarize,
  onOpen
}: {
  groups: ZotzTaskGroup[]
  facts: ReadonlyMap<string, ZotzTaskFacts>
  /** The view's summed field: its own column, and its sum in the group rows. */
  sumField: string | null
  summarize?: ZotzTaskSummarize
  onOpen: (item: ZotzTaskBoardItem) => void
}): React.JSX.Element {
  const t = useTranslate()
  const columnCount = sumField ? 8 : 7
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border/50 scrollbar-sleek">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-background text-left text-muted-foreground">
          <tr className="border-b border-border/50">
            <th className="py-2 pr-3 pl-0 font-medium">
              {t('zotz.taskBoard.table.title', 'Title')}
            </th>
            <th className="py-2 pr-3 font-medium">{t('zotz.taskBoard.table.source', 'Source')}</th>
            <th className="py-2 pr-3 font-medium">{t('zotz.taskBoard.table.status', 'Status')}</th>
            <th className="py-2 pr-3 font-medium">
              {t('zotz.taskBoard.table.assignees', 'Assignees')}
            </th>
            <th className="py-2 pr-3 font-medium">{t('zotz.taskBoard.table.labels', 'Labels')}</th>
            <th className="py-2 pr-3 font-medium">
              {t('zotz.taskBoard.table.pullRequest', 'Pull request')}
            </th>
            {sumField ? (
              <th className="py-2 pr-3 text-right font-medium" title={sumField}>
                {sumField}
              </th>
            ) : null}
            <th className="py-2 font-medium">{t('zotz.taskBoard.table.updated', 'Updated')}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => [
            // Ungrouped tables only get a header row to carry the view's sum.
            group.key === '' && !summarize ? null : (
              <tr key={`group:${group.key}`} className="bg-muted/30">
                <td colSpan={columnCount} className="py-1.5 font-medium">
                  {[
                    group.key === ''
                      ? t('zotz.taskBoard.slice.all', 'All')
                      : (group.label ?? t('zotz.taskBoard.group.empty', 'None')),
                    group.items.length,
                    summarize?.(group.items)
                  ]
                    .filter((part) => part !== null && part !== undefined)
                    .join(' · ')}
                </td>
              </tr>
            ),
            ...group.items.map((item) => (
              <Row
                key={`${group.key}:${item.key}`}
                item={item}
                facts={facts.get(item.key)}
                sumField={sumField}
                onOpen={() => onOpen(item)}
              />
            ))
          ])}
        </tbody>
      </table>
    </div>
  )
}
