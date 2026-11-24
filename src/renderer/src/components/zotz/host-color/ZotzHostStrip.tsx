import React from 'react'
import { Server } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { useZotzWorktreeHost } from './use-zotz-host-color'

/** Above a workspace's panes: names the other machine its terminals run on, in that machine's color. */
export function ZotzHostStrip({ worktreeId }: { worktreeId: string }): React.JSX.Element | null {
  const t = useTranslate()
  const host = useZotzWorktreeHost(worktreeId)
  if (!host) {
    return null
  }
  return (
    <div
      data-zotz-host-strip={host.hostId}
      className="flex h-6 shrink-0 items-center gap-1.5 border-b border-border px-2 text-xs text-foreground"
      style={{
        backgroundColor: `color-mix(in srgb, ${host.color} 16%, var(--background))`,
        boxShadow: `inset 3px 0 0 ${host.color}`
      }}
    >
      <Server aria-hidden className="size-3 shrink-0" style={{ color: host.color }} />
      <span className="truncate font-medium">
        {t('zotz.hostColor.runsOn', 'Runs on {{host}}', { host: host.label })}
      </span>
    </div>
  )
}
