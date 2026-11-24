import React from 'react'
import { cn } from '@/lib/class-names'
import { useZotzWorktreeHost } from './use-zotz-host-color'

// A background image over each tab's own background, so idle, hover and active states still show.
const TINTED_TABS =
  '[&_[data-testid=sortable-tab]]:[background-image:linear-gradient(var(--zotz-host-tint),var(--zotz-host-tint))] [&_[data-testid=sortable-tab]]:shadow-[inset_0_2px_0_var(--zotz-host-color)]'

/** The tab bar's slot in a tab group; its tabs take their machine's color when the workspace runs on another one. */
export function ZotzHostTabTint({
  worktreeId,
  children
}: {
  worktreeId: string
  children: React.ReactNode
}): React.JSX.Element {
  const host = useZotzWorktreeHost(worktreeId)
  const style: (React.CSSProperties & Record<`--zotz-host-${string}`, string>) | undefined = host
    ? {
        '--zotz-host-color': host.color,
        '--zotz-host-tint': `color-mix(in srgb, ${host.color} 14%, transparent)`
      }
    : undefined
  return (
    <div
      data-zotz-host-tabs={host?.hostId}
      className={cn('min-w-10 flex-1 h-full', host && TINTED_TABS)}
      style={style}
    >
      {children}
    </div>
  )
}
