import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import {
  chipStyle,
  singleSelectChipColors
} from '../../github-project/cells/project-cell-chip-colors'
import {
  zotzTaskSliceField,
  type ZotzTaskSlice,
  type ZotzTaskSliceBy
} from '../../../../../shared/zotz/tasks/zotz-task-slices'

/** The name of what a view slices (or groups) by: a built-in attribute or the field's own name. */
export function useZotzTaskSliceByLabel(): (sliceBy: ZotzTaskSliceBy) => string {
  const t = useTranslate()
  return (sliceBy) => {
    switch (sliceBy) {
      case 'assignee':
        return t('zotz.taskBoard.slice.assignee', 'Assignee')
      case 'label':
        return t('zotz.taskBoard.slice.label', 'Label')
      case 'status':
        return t('zotz.taskBoard.slice.status', 'Status')
      case 'project':
        return t('zotz.taskBoard.slice.project', 'Project')
      case 'source':
        return t('zotz.taskBoard.slice.source', 'Source')
      case 'repo':
        return t('zotz.taskBoard.slice.repo', 'Repository')
    }
    return zotzTaskSliceField(sliceBy) ?? sliceBy
  }
}

function SliceRow({
  label,
  count,
  color,
  selected,
  onSelect
}: {
  label: string
  count: number
  color: string | null
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  const colors = color ? singleSelectChipColors(color) : null
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs',
        selected ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60'
      )}
    >
      {colors ? (
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full bg-[var(--github-project-chip-fg-light)] dark:bg-[var(--github-project-chip-fg-dark)]"
          style={chipStyle(colors)}
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-[11px] tabular-nums">{count}</span>
    </button>
  )
}

/** GitHub's "Slice by" panel: each value with its count, "All" first; a click filters the board. */
export function ZotzTaskSlicePanel({
  sliceBy,
  slices,
  total,
  active,
  onSelect
}: {
  sliceBy: ZotzTaskSliceBy
  slices: ZotzTaskSlice[]
  total: number
  active: { value: string | null } | null
  onSelect: (slice: { value: string | null } | null) => void
}): React.JSX.Element {
  const t = useTranslate()
  const fieldLabel = useZotzTaskSliceByLabel()(sliceBy)
  return (
    <nav
      aria-label={t('zotz.taskBoard.slice.panel', 'Slice by {{field}}', { field: fieldLabel })}
      className="flex w-48 shrink-0 flex-col gap-1 rounded-lg border border-border/50 bg-muted/20 p-1.5"
    >
      <p className="truncate px-2 pt-1 pb-0.5 text-[11px] font-medium text-muted-foreground">
        {fieldLabel}
      </p>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto scrollbar-sleek">
        <SliceRow
          label={t('zotz.taskBoard.slice.all', 'All')}
          count={total}
          color={null}
          selected={active === null}
          onSelect={() => onSelect(null)}
        />
        {slices.map((slice) => (
          <SliceRow
            key={slice.value ?? '\0none'}
            label={
              slice.value ?? t('zotz.taskBoard.slice.none', 'No {{field}}', { field: fieldLabel })
            }
            count={slice.count}
            color={slice.color}
            selected={active !== null && active.value === slice.value}
            onSelect={() => onSelect({ value: slice.value })}
          />
        ))}
      </div>
    </nav>
  )
}
