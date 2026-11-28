import { formatUiNarrowRelativeTime } from '@/i18n/relative-time-format'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** "5m ago", "3h ago": the sidebar's data line is too narrow for "5 minutes ago". */
export function formatZotzCompactAgo(timestamp: number, now = Date.now()): string {
  const ago = Math.max(0, now - timestamp)
  if (ago < MINUTE) {
    return formatUiNarrowRelativeTime(-Math.round(ago / 1000), 'second')
  }
  if (ago < HOUR) {
    return formatUiNarrowRelativeTime(-Math.round(ago / MINUTE), 'minute')
  }
  if (ago < DAY) {
    return formatUiNarrowRelativeTime(-Math.round(ago / HOUR), 'hour')
  }
  return formatUiNarrowRelativeTime(-Math.round(ago / DAY), 'day')
}
