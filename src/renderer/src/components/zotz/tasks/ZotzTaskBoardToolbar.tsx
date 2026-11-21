import { Archive, ChartGantt, Columns3, RefreshCw, Rows3, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import type {
  ZotzTaskBoardGroupBy,
  ZotzTaskBoardLayout,
  ZotzTaskBoardSortBy
} from '../../../../../shared/zotz/tasks/zotz-task-board-views'
import type { ZotzTaskField } from '../../../../../shared/zotz/tasks/zotz-task-fields'
import {
  isZotzTaskSliceBy,
  ZOTZ_TASK_SLICE_BUILTINS,
  type ZotzTaskSliceBy
} from '../../../../../shared/zotz/tasks/zotz-task-slices'
import type { ZotzTaskBoardViewsState } from './use-zotz-task-board-views'
import { useZotzTaskSliceByLabel } from './ZotzTaskSlicePanel'

export const ZOTZ_TASK_SCOPE_ALL = 'all'
export const ZOTZ_TASK_SCOPE_EXTERNAL = 'external:'

export type ZotzTaskScopeOption = { value: string; label: string }

const NONE = 'zotz:none'

function isGroupBy(value: string): value is ZotzTaskBoardGroupBy {
  return ['none', 'source', 'project', 'assignee', 'status'].includes(value)
}

function isSortBy(value: string): value is ZotzTaskBoardSortBy {
  return ['manual', 'updated', 'title'].includes(value)
}

/** The active view's settings, edited in place; changes stay unsaved until "Save view". */
export function ZotzTaskBoardToolbar({
  state,
  scopes,
  fields,
  lastUpdatedAt,
  relayState,
  refreshing,
  onRefresh,
  archivedCount,
  showArchived,
  onToggleArchived,
  onManageSources
}: {
  state: ZotzTaskBoardViewsState
  scopes: ZotzTaskScopeOption[]
  /** Source fields of the tasks in scope, for the sum and slice pickers. */
  fields: ZotzTaskField[]
  lastUpdatedAt: number | null
  /** Shown only once the user turned the relay on. */
  relayState: 'off' | 'live' | 'failing'
  refreshing: boolean
  onRefresh: () => void
  archivedCount: number
  showArchived: boolean
  onToggleArchived: () => void
  onManageSources: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const locale = useIntlLocale()
  const sliceByLabel = useZotzTaskSliceByLabel()
  const { view } = state
  const numberFields = fields.filter((field) => field.type === 'number')
  const sliceOptions: ZotzTaskSliceBy[] = [
    ...ZOTZ_TASK_SLICE_BUILTINS,
    ...fields.flatMap((field): ZotzTaskSliceBy[] =>
      field.type === 'single-select' || field.type === 'iteration' ? [`field:${field.name}`] : []
    )
  ]
  // A saved choice whose field no task has right now stays selectable instead of vanishing.
  if (view.sliceBy && !sliceOptions.includes(view.sliceBy)) {
    sliceOptions.push(view.sliceBy)
  }
  const sumOptions = numberFields.map((field) => field.name)
  if (view.sumField && !sumOptions.includes(view.sumField)) {
    sumOptions.push(view.sumField)
  }
  const layouts: { value: ZotzTaskBoardLayout; label: string; icon: React.ReactNode }[] = [
    {
      value: 'board',
      label: t('zotz.taskBoard.layout.board', 'Board'),
      icon: <Columns3 className="size-3.5" />
    },
    {
      value: 'table',
      label: t('zotz.taskBoard.layout.table', 'Table'),
      icon: <Rows3 className="size-3.5" />
    },
    {
      value: 'roadmap',
      label: t('zotz.taskBoard.layout.roadmap', 'Roadmap'),
      icon: <ChartGantt className="size-3.5" />
    }
  ]
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={view.scope} onValueChange={(scope) => state.update({ scope })}>
        <SelectTrigger size="sm" className="w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ZOTZ_TASK_SCOPE_ALL}>
            {t('zotz.taskBoard.view.all', 'All projects')}
          </SelectItem>
          {scopes.map((scope) => (
            <SelectItem key={scope.value} value={scope.value}>
              {scope.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={view.filter}
        onChange={(event) => state.update({ filter: event.target.value })}
        placeholder={t(
          'zotz.taskBoard.filterPlaceholder',
          'Filter: is:open assignee:@me label:bug'
        )}
        className="h-8 w-72"
      />
      <div className="flex items-center rounded-md border border-border/60">
        {layouts.map((layout) => (
          <Button
            key={layout.value}
            variant={view.layout === layout.value ? 'secondary' : 'ghost'}
            size="icon-sm"
            type="button"
            aria-label={layout.label}
            title={layout.label}
            aria-pressed={view.layout === layout.value}
            onClick={() => state.update({ layout: layout.value })}
          >
            {layout.icon}
          </Button>
        ))}
      </div>
      <Select
        value={view.groupBy}
        onValueChange={(value) => (isGroupBy(value) ? state.update({ groupBy: value }) : undefined)}
      >
        <SelectTrigger size="sm" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t('zotz.taskBoard.group.none', 'No grouping')}</SelectItem>
          <SelectItem value="source">
            {t('zotz.taskBoard.group.source', 'Group by source')}
          </SelectItem>
          <SelectItem value="project">
            {t('zotz.taskBoard.group.project', 'Group by project')}
          </SelectItem>
          <SelectItem value="assignee">
            {t('zotz.taskBoard.group.assignee', 'Group by assignee')}
          </SelectItem>
          <SelectItem value="status">
            {t('zotz.taskBoard.group.status', 'Group by status')}
          </SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={view.sortBy}
        onValueChange={(value) => (isSortBy(value) ? state.update({ sortBy: value }) : undefined)}
      >
        <SelectTrigger size="sm" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="manual">{t('zotz.taskBoard.sort.manual', 'Source order')}</SelectItem>
          <SelectItem value="updated">
            {t('zotz.taskBoard.sort.updated', 'Recently updated')}
          </SelectItem>
          <SelectItem value="title">{t('zotz.taskBoard.sort.title', 'Title')}</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={view.sliceBy ?? NONE}
        onValueChange={(value) =>
          state.update({ sliceBy: isZotzTaskSliceBy(value) ? value : null })
        }
      >
        <SelectTrigger size="sm" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t('zotz.taskBoard.slice.off', 'No slice')}</SelectItem>
          {sliceOptions.map((option) => (
            <SelectItem key={option} value={option}>
              {t('zotz.taskBoard.slice.by', 'Slice: {{field}}', { field: sliceByLabel(option) })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={view.sumField ?? NONE}
        onValueChange={(value) => state.update({ sumField: value === NONE ? null : value })}
      >
        <SelectTrigger size="sm" className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t('zotz.taskBoard.sum.off', 'Count only')}</SelectItem>
          {sumOptions.map((name) => (
            <SelectItem key={name} value={name}>
              {t('zotz.taskBoard.sum.field', 'Sum: {{field}}', { field: name })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="ml-auto flex items-center gap-1">
        {relayState !== 'off' ? (
          <span
            className="flex items-center gap-1 text-xs text-muted-foreground"
            title={
              relayState === 'live'
                ? t('zotz.taskRelay.liveHint', 'Changes arrive from your relay as they happen.')
                : t(
                    'zotz.taskRelay.failingHint',
                    "The relay isn't answering, so the board checks GitHub every 5 minutes."
                  )
            }
          >
            <span
              className={cn(
                'size-1.5 rounded-full',
                relayState === 'live' ? 'bg-status-success' : 'bg-status-warning'
              )}
            />
            {relayState === 'live'
              ? t('zotz.taskRelay.live', 'Live')
              : t('zotz.taskRelay.failing', 'Relay down')}
          </span>
        ) : null}
        {lastUpdatedAt ? (
          <span className="text-xs text-muted-foreground">
            {t('zotz.taskBoard.updatedAt', 'Updated {{time}}', {
              time: new Date(lastUpdatedAt).toLocaleTimeString(locale, {
                hour: '2-digit',
                minute: '2-digit'
              })
            })}
          </span>
        ) : null}
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={t('zotz.taskBoard.refresh', 'Refresh')}
          title={t('zotz.taskBoard.refresh', 'Refresh')}
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
        </Button>
        <Button
          variant={showArchived ? 'secondary' : 'ghost'}
          size="sm"
          type="button"
          onClick={onToggleArchived}
        >
          <Archive className="size-3.5" />
          {t('zotz.taskBoard.archived', 'Archived ({{total}})', { total: archivedCount })}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={t('zotz.taskBoard.manageSources', 'Choose sources')}
          title={t('zotz.taskBoard.manageSources', 'Choose sources')}
          onClick={onManageSources}
        >
          <Settings2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
