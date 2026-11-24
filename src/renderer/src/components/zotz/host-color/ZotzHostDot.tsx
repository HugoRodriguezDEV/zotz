import React from 'react'
import { cn } from '@/lib/class-names'

/** A machine's color as a small dot, for rows and headers that already name the machine. */
export function ZotzHostDot({
  color,
  className
}: {
  color: string
  className?: string
}): React.JSX.Element {
  return (
    <span
      aria-hidden
      data-zotz-host-dot=""
      className={cn('size-2 shrink-0 rounded-full', className)}
      style={{ backgroundColor: color }}
    />
  )
}
