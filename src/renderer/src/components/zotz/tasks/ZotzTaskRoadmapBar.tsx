import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/class-names'
import {
  chipStyle,
  singleSelectChipColors
} from '../../github-project/cells/project-cell-chip-colors'
import { formatRoadmapSpan } from '../../github-project/roadmap/roadmap-tick-format'
import {
  roadmapOffsetPx,
  type RoadmapSpan,
  type RoadmapTick
} from '../../../../../shared/github/projects/project-roadmap-timeline'
import {
  ZOTZ_TASK_BOARD_COLUMNS,
  type ZotzTaskBoardItem
} from '../../../../../shared/zotz/tasks/zotz-task-board-columns'
import { ZotzTaskBrand } from './ZotzTaskCard'
import { zotzTaskCardView } from './zotz-task-card-view'

const MIN_BAR_WIDTH_PX = 24

/** Bars take the color of the task's Zotz column, like a Project roadmap colors by Status. */
function columnColor(item: ZotzTaskBoardItem): string {
  return ZOTZ_TASK_BOARD_COLUMNS.find((column) => column.id === item.column)?.color ?? 'GRAY'
}

export function ZotzTaskRoadmapLabel({
  item,
  onOpen
}: {
  item: ZotzTaskBoardItem
  onOpen: () => void
}): React.JSX.Element {
  const view = zotzTaskCardView(item)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left text-xs hover:underline"
    >
      <ZotzTaskBrand brand={view.brand} className="size-3 shrink-0 text-muted-foreground" />
      {view.numberLabel ? (
        <span className="shrink-0 text-muted-foreground">{view.numberLabel}</span>
      ) : null}
      <span className="truncate font-medium">{item.title}</span>
    </button>
  )
}

export function ZotzTaskRoadmapBar({
  item,
  span,
  ticks,
  tickWidth,
  locale,
  onOpen
}: {
  item: ZotzTaskBoardItem
  span: RoadmapSpan
  ticks: RoadmapTick[]
  tickWidth: number
  locale: string
  onOpen: () => void
}): React.JSX.Element {
  const left = roadmapOffsetPx(span.startMs, ticks, tickWidth)
  const width = roadmapOffsetPx(span.endMs, ticks, tickWidth) - left
  const dates = formatRoadmapSpan(span, locale)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${item.title} — ${dates}`}
          className={cn(
            'absolute top-1/2 flex h-6 -translate-y-1/2 cursor-pointer items-center gap-1.5 overflow-hidden rounded-md px-2 text-[11px] font-medium leading-none hover:brightness-110',
            'text-[var(--github-project-chip-fg-light)] dark:text-[var(--github-project-chip-fg-dark)]',
            span.point && 'max-w-60'
          )}
          style={{
            left: span.point ? Math.max(0, left - 6) : left,
            ...(span.point ? {} : { width: Math.max(width, MIN_BAR_WIDTH_PX) }),
            ...chipStyle(singleSelectChipColors(columnColor(item)))
          }}
        >
          {span.point ? (
            <span aria-hidden className="size-2 shrink-0 rotate-45 rounded-[1px] bg-current" />
          ) : null}
          <span className="truncate">{item.title}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="start">
        <div className="max-w-72 space-y-0.5">
          <div className="truncate font-medium">{item.title}</div>
          <div className="text-muted-foreground">{dates}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
