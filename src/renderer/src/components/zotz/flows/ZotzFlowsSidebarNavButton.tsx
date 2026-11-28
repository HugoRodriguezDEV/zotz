import React from 'react'
import { Workflow } from 'lucide-react'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import { openZotzFlows, useZotzFlowsOpen } from './zotz-flows-page-store'

/** Takes the Automations row of upstream's sidebar: automations became flows (spec §8). */
// Upstream's Automations row stays in the code, off: its page redirects here.
export const ZOTZ_SHOWS_AUTOMATIONS_ROW = false

export function ZotzFlowsSidebarNavButton(): React.JSX.Element {
  const t = useTranslate()
  const active = useZotzFlowsOpen()
  return (
    <button
      type="button"
      onClick={openZotzFlows}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight transition-colors',
        active
          ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
          : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
      )}
    >
      <Workflow
        className={cn('size-4 shrink-0', !active && 'text-worktree-sidebar-foreground/30')}
        strokeWidth={active ? 2.25 : 1.75}
      />
      <span className="flex-1">{t('zotz.flows.title', 'Flows')}</span>
    </button>
  )
}
