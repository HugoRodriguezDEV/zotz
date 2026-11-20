import { Archive, Columns3, RefreshCw, Rows3, Settings2 } from 'lucide-react'
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
  ZotzTaskBoardSortBy
} from '../../../../../shared/zotz/tasks/zotz-task-board-views'
import type { ZotzTaskBoardViewsState } from './use-zotz-task-board-views'

export const ZOTZ_TASK_SCOPE_ALL = 'all'
export const ZOTZ_TASK_SCOPE_EXTERNAL = 'external:'

export type ZotzTaskScopeOption = { value: string; label: string }

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
  const { view } = state
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
        <Button
          variant={view.layout === 'board' ? 'secondary' : 'ghost'}
          size="icon-sm"
          type="button"
          aria-label={t('zotz.taskBoard.layout.board', 'Board')}
          title={t('zotz.taskBoard.layout.board', 'Board')}
          aria-pressed={view.layout === 'board'}
          onClick={() => state.update({ layout: 'board' })}
        >
          <Columns3 className="size-3.5" />
        </Button>
        <Button
          variant={view.layout === 'table' ? 'secondary' : 'ghost'}
          size="icon-sm"
          type="button"
          aria-label={t('zotz.taskBoard.layout.table', 'Table')}
          title={t('zotz.taskBoard.layout.table', 'Table')}
          aria-pressed={view.layout === 'table'}
          onClick={() => state.update({ layout: 'table' })}
        >
          <Rows3 className="size-3.5" />
        </Button>
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
