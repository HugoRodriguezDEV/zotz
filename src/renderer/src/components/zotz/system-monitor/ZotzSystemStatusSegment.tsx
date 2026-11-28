import { useEffect, useRef } from 'react'
import { Activity } from 'lucide-react'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../../status-bar/composition/status-bar-context-menu-policy'
import type { ZotzSystemStatus } from '../../../../../shared/zotz/system-monitor/zotz-system-monitor-contract'
import { openZotzAgentQueueDrawer } from '../agent-queue/zotz-agent-queue-drawer-open'
import { formatZotzGb } from '../agent-queue/zotz-memory-format'
import { useZotzSystemStatus } from './zotz-system-status-store'

export function zotzMemoryUsedPercent(memory: NonNullable<ZotzSystemStatus['memory']>): number {
  return memory.totalBytes > 0
    ? Math.round(((memory.totalBytes - memory.availableBytes) / memory.totalBytes) * 100)
    : 0
}

/**
 * Warns once each time memory crosses into critical, with the governor's own floor: the same
 * limit that stops new agents, so the bar never disagrees with the queue.
 */
function useCriticalMemoryNotice(status: ZotzSystemStatus | null): void {
  const t = useTranslate()
  const wasCritical = useRef(false)
  const memory = status?.memory
  const critical = memory?.pressure === 'critical'
  useEffect(() => {
    if (critical && !wasCritical.current && memory) {
      toast.warning(t('zotz.systemMonitor.memoryCriticalTitle', 'Memory is critical'), {
        description: t(
          'zotz.systemMonitor.memoryCriticalBody',
          '{{free}} GB free, under the {{min}} GB Zotz keeps for the system. New agents wait in the queue until memory frees.',
          { free: formatZotzGb(memory.availableBytes), min: formatZotzGb(memory.minFreeBytes) }
        ),
        action: {
          label: t('zotz.systemMonitor.memoryCriticalAction', 'See what uses it'),
          onClick: () => openZotzAgentQueueDrawer('system')
        }
      })
    }
    wasCritical.current = critical
  }, [critical, memory, t])
}

/** `CPU · MEM` beside the queue segment; opens the System tab (docs/zotz/specs/SPEC-monitor-y-remotos.md §A.4). */
export function ZotzSystemStatusSegment({ iconOnly }: { iconOnly: boolean }): React.JSX.Element {
  const t = useTranslate()
  const status = useZotzSystemStatus()
  useCriticalMemoryNotice(status)
  const memory = status?.memory ?? null
  const cpu = status?.cpuPercent
  const label = t('zotz.systemMonitor.statusSegment', 'CPU {{cpu}} · MEM {{mem}}', {
    cpu: cpu == null ? '—' : `${Math.round(cpu)}%`,
    mem: memory ? `${zotzMemoryUsedPercent(memory)}%` : '—'
  })
  const tooltip = memory
    ? t(
        'zotz.systemMonitor.statusTooltip',
        'This machine: {{used}} of {{total}} GB in use, {{free}} GB free · open System',
        {
          used: formatZotzGb(memory.totalBytes - memory.availableBytes),
          total: formatZotzGb(memory.totalBytes),
          free: formatZotzGb(memory.availableBytes)
        }
      )
    : t('zotz.systemMonitor.statusTooltipNoMemory', 'This machine’s CPU and memory · open System')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
          className={cn(
            'inline-flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground',
            memory?.pressure === 'critical' && 'text-destructive hover:text-destructive'
          )}
          aria-label={label}
          data-zotz-system-status-segment=""
          onClick={() => openZotzAgentQueueDrawer('system')}
        >
          <Activity className="size-3" />
          {!iconOnly ? <span className="text-2xs font-medium tabular-nums">{label}</span> : null}
          {memory?.pressure === 'elevated' ? (
            <span aria-hidden className="size-1.5 rounded-full bg-agent-question" />
          ) : null}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}
