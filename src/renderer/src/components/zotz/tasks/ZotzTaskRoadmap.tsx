import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import { formatRoadmapTick } from '../../github-project/roadmap/roadmap-tick-format'
import {
  buildRoadmapTicks,
  roadmapOffsetPx,
  type RoadmapSpan
} from '../../../../../shared/github/projects/project-roadmap-timeline'
import type { ZotzTaskBoardItem } from '../../../../../shared/zotz/tasks/zotz-task-board-columns'
import type { ZotzTaskField } from '../../../../../shared/zotz/tasks/zotz-task-fields'
import type { ZotzTaskFacts } from '../../../../../shared/zotz/tasks/zotz-task-filter'
import {
  zotzTaskRoadmapDefaultFields,
  zotzTaskRoadmapSpan
} from '../../../../../shared/zotz/tasks/zotz-task-roadmap'
import type {
  ZotzTaskBoardView,
  ZotzTaskGroup,
  ZotzTaskRoadmapZoom
} from '../../../../../shared/zotz/tasks/zotz-task-board-views'
import { ZotzTaskRoadmapBar, ZotzTaskRoadmapLabel } from './ZotzTaskRoadmapBar'
import { ZotzTaskRoadmapControls, type ZotzTaskRoadmapPatch } from './ZotzTaskRoadmapControls'
import type { ZotzTaskSummarize } from './use-zotz-task-sum'

const LABEL_WIDTH_PX = 260
const LANE_HEIGHT_PX = 34
const TICK_WIDTH_PX: Record<ZotzTaskRoadmapZoom, number> = { month: 148, quarter: 128 }

/** The roadmap grid counts UTC days, so today is the viewer's local date at UTC midnight. */
function todayAsUtcMidnight(now: number): number {
  const date = new Date(now)
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

/**
 * The roadmap layout: a bar per task from the view's start to end field (dates or an iteration),
 * month or quarter zoom, a line for today, and tasks without dates listed apart. Read-only.
 */
export function ZotzTaskRoadmap({
  view,
  groups,
  facts,
  fields,
  now,
  summarize,
  onUpdate,
  onOpen
}: {
  view: ZotzTaskBoardView
  groups: ZotzTaskGroup[]
  facts: ReadonlyMap<string, ZotzTaskFacts>
  fields: ZotzTaskField[]
  now: number
  summarize?: ZotzTaskSummarize
  onUpdate: (patch: ZotzTaskRoadmapPatch) => void
  onOpen: (item: ZotzTaskBoardItem) => void
}): React.JSX.Element {
  const t = useTranslate()
  const locale = useIntlLocale()
  const prefersReducedMotion = usePrefersReducedMotion()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const zoom = view.roadmapZoom
  const tickWidth = TICK_WIDTH_PX[zoom]
  const todayMs = todayAsUtcMidnight(now)

  const placeable = useMemo(
    () => fields.filter((field) => field.type === 'date' || field.type === 'iteration'),
    [fields]
  )
  const { start, end } =
    view.roadmapStart === null && view.roadmapEnd === null
      ? zotzTaskRoadmapDefaultFields(placeable)
      : { start: view.roadmapStart, end: view.roadmapEnd }

  const spans = useMemo(() => {
    const byKey = new Map<string, RoadmapSpan>()
    for (const group of groups) {
      for (const item of group.items) {
        const span = zotzTaskRoadmapSpan(facts.get(item.key)?.fields ?? {}, start, end)
        if (span) {
          byKey.set(item.key, span)
        }
      }
    }
    return byKey
  }, [end, facts, groups, start])
  const undated = useMemo(() => {
    const seen = new Map<string, ZotzTaskBoardItem>()
    for (const item of groups.flatMap((group) => group.items)) {
      if (!spans.has(item.key)) {
        seen.set(item.key, item)
      }
    }
    return [...seen.values()]
  }, [groups, spans])

  const ticks = useMemo(
    () => buildRoadmapTicks([...spans.values()], zoom, todayMs),
    [spans, todayMs, zoom]
  )
  const timelineWidth = ticks.length * tickWidth
  const todayPx = roadmapOffsetPx(todayMs, ticks, tickWidth)

  const scrollToToday = useCallback(() => {
    const scroller = scrollRef.current
    scroller?.scrollTo({
      left: Math.max(0, todayPx - (scroller.clientWidth - LABEL_WIDTH_PX) / 3),
      behavior: prefersReducedMotion ? 'instant' : 'smooth'
    })
  }, [prefersReducedMotion, todayPx])
  const todayPxRef = useRef(todayPx)
  useLayoutEffect(() => {
    todayPxRef.current = todayPx
  })
  // Start near today when the roadmap opens or zoom changes; refreshes keep the user's scroll.
  useEffect(() => {
    const scroller = scrollRef.current
    if (scroller) {
      scroller.scrollLeft = Math.max(
        0,
        todayPxRef.current - (scroller.clientWidth - LABEL_WIDTH_PX) / 3
      )
    }
  }, [zoom])

  const grouped = view.groupBy !== 'none'
  const bandWidth = LABEL_WIDTH_PX + timelineWidth

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/50">
      <ZotzTaskRoadmapControls
        start={start}
        end={end}
        fields={placeable}
        zoom={zoom}
        onUpdate={onUpdate}
        onToday={scrollToToday}
      />
      {placeable.length === 0 ? (
        <p className="flex-none px-3 py-2 text-xs text-muted-foreground">
          {t(
            'zotz.taskBoard.roadmap.noFields',
            'These tasks have no date or iteration field yet. Add one in GitHub or in the service to place them here.'
          )}
        </p>
      ) : null}
      <div ref={scrollRef} className="min-h-0 min-w-0 flex-1 overflow-auto scrollbar-sleek">
        <div className="relative w-max min-w-full">
          <div className="sticky top-0 z-20 flex border-b border-border/60 bg-background">
            <div
              className="sticky left-0 z-30 shrink-0 border-r border-border/50 bg-background px-3 py-2 text-[11px] font-medium text-muted-foreground"
              style={{ width: LABEL_WIDTH_PX }}
            >
              {t('zotz.taskBoard.roadmap.task', 'Task')}
            </div>
            <div className="relative flex">
              {ticks.map((tick, index) => {
                const { label, sublabel } = formatRoadmapTick(tick, zoom, index, locale)
                return (
                  <div
                    key={tick.key}
                    className="shrink-0 border-l border-border/40 px-2 py-2 text-[11px] text-muted-foreground"
                    style={{ width: tickWidth }}
                  >
                    <span className="font-medium text-foreground/80">{label}</span>
                    {sublabel ? <span className="ml-1 opacity-70">{sublabel}</span> : null}
                  </div>
                )
              })}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-px bg-foreground/40"
                style={{ left: todayPx }}
              />
            </div>
          </div>
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0"
              style={{
                left: LABEL_WIDTH_PX,
                backgroundImage: 'linear-gradient(to right, var(--border) 0 1px, transparent 1px)',
                backgroundSize: `${tickWidth}px 100%`
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 z-10 w-px bg-foreground/40"
              style={{ left: LABEL_WIDTH_PX + todayPx }}
            />
            {groups.map((group) => {
              const dated = group.items.filter((item) => spans.has(item.key))
              if (grouped && dated.length === 0) {
                return null
              }
              const summary = summarize?.(group.items)
              return (
                <div key={group.key}>
                  {grouped ? (
                    <div
                      className="relative z-10 flex border-b border-border/40 bg-muted"
                      style={{ width: bandWidth }}
                    >
                      <p
                        className="sticky left-0 truncate bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
                        style={{ width: LABEL_WIDTH_PX }}
                      >
                        {[
                          group.label ?? t('zotz.taskBoard.group.empty', 'None'),
                          group.items.length,
                          summary
                        ]
                          .filter((part) => part !== null && part !== undefined)
                          .join(' · ')}
                      </p>
                    </div>
                  ) : null}
                  {dated.map((item) => {
                    const span = spans.get(item.key)
                    return (
                      <div
                        key={`${group.key}:${item.key}`}
                        className="group flex items-stretch border-b border-border/30 hover:bg-accent/40"
                        style={{ minHeight: LANE_HEIGHT_PX }}
                      >
                        <div
                          className="sticky left-0 z-10 flex shrink-0 items-center border-r border-border/40 bg-background px-3 group-hover:bg-accent"
                          style={{ width: LABEL_WIDTH_PX }}
                        >
                          <ZotzTaskRoadmapLabel item={item} onOpen={() => onOpen(item)} />
                        </div>
                        <div className="relative shrink-0" style={{ width: timelineWidth }}>
                          {span ? (
                            <ZotzTaskRoadmapBar
                              item={item}
                              span={span}
                              ticks={ticks}
                              tickWidth={tickWidth}
                              locale={locale}
                              onOpen={() => onOpen(item)}
                            />
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      {undated.length > 0 ? (
        <section className="flex max-h-36 flex-none flex-col border-t border-border/50">
          <p className="flex-none px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">
            {t('zotz.taskBoard.roadmap.undated', 'Without dates · {{count}}', {
              count: undated.length
            })}
          </p>
          <ul className="min-h-0 overflow-y-auto px-3 pb-2 scrollbar-sleek">
            {undated.map((item) => (
              <li key={item.key} className="flex h-7 items-center">
                <ZotzTaskRoadmapLabel item={item} onOpen={() => onOpen(item)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
