import { cn } from '@/lib/class-names'

export type ZotzSystemChartPoint = { t: number; value: number | null }

export type ZotzSystemChartSeries = {
  points: readonly ZotzSystemChartPoint[]
  /** First series is filled; the second is a line only, so both stay readable. */
  tone: 'primary' | 'secondary'
}

const WIDTH = 600
const HEIGHT = 100

/** Splits a series where a reading is missing or nobody was watching. */
function segments(
  points: readonly ZotzSystemChartPoint[],
  maxGapMs: number
): ZotzSystemChartPoint[][] {
  const out: ZotzSystemChartPoint[][] = []
  let current: ZotzSystemChartPoint[] = []
  let previous: number | null = null
  for (const point of points) {
    if (point.value === null || (previous !== null && point.t - previous > maxGapMs)) {
      if (current.length > 0) {
        out.push(current)
      }
      current = []
    }
    if (point.value !== null) {
      current.push(point)
    }
    previous = point.t
  }
  if (current.length > 0) {
    out.push(current)
  }
  return out
}

/**
 * History over a fixed window ending now, so gaps show where the tab was closed. `max` pins the
 * scale (percent charts); without it the busiest point sets it.
 */
export function ZotzSystemHistoryChart({
  series,
  endAt,
  windowMs,
  intervalMs,
  max,
  className
}: {
  series: readonly ZotzSystemChartSeries[]
  endAt: number
  windowMs: number
  intervalMs: number
  max?: number
  className?: string
}): React.JSX.Element {
  const startAt = endAt - windowMs
  let top = max ?? 0
  if (max === undefined) {
    for (const { points } of series) {
      for (const point of points) {
        if (point.value !== null && point.value > top) {
          top = point.value
        }
      }
    }
    top = top > 0 ? top * 1.15 : 1
  }
  const x = (t: number): number => ((t - startAt) / windowMs) * WIDTH
  const y = (value: number): number => HEIGHT - (Math.min(value, top) / top) * HEIGHT
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden
      className={cn('block w-full overflow-visible', className)}
    >
      <line
        x1={0}
        x2={WIDTH}
        y1={HEIGHT}
        y2={HEIGHT}
        className="stroke-border"
        vectorEffect="non-scaling-stroke"
      />
      {series.map(({ points, tone }, index) =>
        segments(
          points.filter((point) => point.t >= startAt),
          intervalMs * 3
        ).map((segment) => {
          const line = segment.map((point) => `${x(point.t)},${y(point.value ?? 0)}`).join(' ')
          const first = segment[0]
          const last = segment.at(-1) ?? first
          return (
            <g key={`${index}-${first.t}`}>
              {tone === 'primary' && segment.length > 1 ? (
                <polygon
                  points={`${x(first.t)},${HEIGHT} ${line} ${x(last.t)},${HEIGHT}`}
                  className="fill-chart-2/15"
                />
              ) : null}
              <polyline
                points={line}
                fill="none"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className={tone === 'primary' ? 'stroke-chart-2' : 'stroke-muted-foreground'}
              />
            </g>
          )
        })
      )}
    </svg>
  )
}
