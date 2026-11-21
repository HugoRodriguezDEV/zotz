import { CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import type { ZotzTaskField } from '../../../../../shared/zotz/tasks/zotz-task-fields'
import type {
  ZotzTaskBoardView,
  ZotzTaskRoadmapZoom
} from '../../../../../shared/zotz/tasks/zotz-task-board-views'

const ZOOMS: ZotzTaskRoadmapZoom[] = ['month', 'quarter']
const NO_FIELD = 'zotz:none'

export type ZotzTaskRoadmapPatch = Partial<
  Pick<ZotzTaskBoardView, 'roadmapStart' | 'roadmapEnd' | 'roadmapZoom'>
>

function FieldSelect({
  label,
  value,
  fields,
  onChange
}: {
  label: string
  value: string | null
  fields: ZotzTaskField[]
  onChange: (value: string | null) => void
}): React.JSX.Element {
  const t = useTranslate()
  const known = value === null || fields.some((field) => field.name === value)
  return (
    <label className="flex items-center gap-1.5">
      <span>{label}</span>
      <Select
        value={value ?? NO_FIELD}
        onValueChange={(next) => onChange(next === NO_FIELD ? null : next)}
      >
        <SelectTrigger size="sm" className="h-7 w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_FIELD}>{t('zotz.taskBoard.roadmap.noField', 'None')}</SelectItem>
          {fields.map((field) => (
            <SelectItem key={`${field.name}:${field.type}`} value={field.name}>
              {field.name}
            </SelectItem>
          ))}
          {value !== null && !known ? <SelectItem value={value}>{value}</SelectItem> : null}
        </SelectContent>
      </Select>
    </label>
  )
}

/** The roadmap's own bar: which fields place the bars (saved in the view), today and zoom. */
export function ZotzTaskRoadmapControls({
  start,
  end,
  fields,
  zoom,
  onUpdate,
  onToday
}: {
  start: string | null
  end: string | null
  fields: ZotzTaskField[]
  zoom: ZotzTaskRoadmapZoom
  onUpdate: (patch: ZotzTaskRoadmapPatch) => void
  onToday: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const zoomLabels: Record<ZotzTaskRoadmapZoom, string> = {
    month: t('zotz.taskBoard.roadmap.month', 'Month'),
    quarter: t('zotz.taskBoard.roadmap.quarter', 'Quarter')
  }
  return (
    <div className="flex flex-none flex-wrap items-center gap-3 border-b border-border/50 px-3 py-1.5 text-xs text-muted-foreground">
      <FieldSelect
        label={t('zotz.taskBoard.roadmap.start', 'Start')}
        value={start}
        fields={fields}
        onChange={(value) => onUpdate({ roadmapStart: value, roadmapEnd: end })}
      />
      <FieldSelect
        label={t('zotz.taskBoard.roadmap.end', 'End')}
        value={end}
        fields={fields}
        onChange={(value) => onUpdate({ roadmapStart: start, roadmapEnd: value })}
      />
      <div className="ml-auto flex items-center gap-1">
        <Button type="button" size="xs" variant="outline" onClick={onToday}>
          <CalendarClock className="size-3" />
          {t('zotz.taskBoard.roadmap.today', 'Today')}
        </Button>
        <div
          role="group"
          aria-label={t('zotz.taskBoard.roadmap.zoom', 'Timeline zoom')}
          className="flex items-center rounded-md border border-border/60"
        >
          {ZOOMS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={option === zoom}
              onClick={() => onUpdate({ roadmapZoom: option })}
              className={cn(
                'cursor-pointer px-2 py-0.5 text-[11px] first:rounded-l-md last:rounded-r-md',
                option === zoom ? 'bg-accent text-foreground' : 'hover:bg-accent/60'
              )}
            >
              {zoomLabels[option]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
