const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/** "12.3 GB": binary steps, one decimal below 100. */
export function formatZotzBytes(bytes: number): string {
  let value = Math.max(0, bytes)
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${UNITS[unit]}`
}

export function formatZotzRate(bytesPerSecond: number): string {
  return `${formatZotzBytes(bytesPerSecond)}/s`
}

export function formatZotzPercent(percent: number): string {
  return `${Math.round(Math.max(0, percent))}%`
}

/** "3 d 4 h", "4 h 12 min", "12 min". */
export function formatZotzDuration(totalSeconds: number): string {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) {
    return `${days} d ${hours} h`
  }
  return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`
}
