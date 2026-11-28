import React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/class-names'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import type { ZotzFlowRun } from '../../../../../shared/zotz/flows/zotz-flow-run-contract'
import { formatAutomationDateTime } from '../../automations/automation-page-parts'
import { ZOTZ_FLOW_TRIGGER_KINDS } from './zotz-flow-trigger-catalog'
import { ZOTZ_FLOW_STATUS_CLASS, ZOTZ_FLOW_STATUS_COPY } from './zotz-flow-node-copy'

/** History of a flow's runs, newest first. */
export function ZotzFlowRunsList({
  runs,
  loading,
  error,
  onOpen,
  onReload
}: {
  runs: readonly ZotzFlowRun[]
  loading: boolean
  error: string | null
  onOpen: (runId: string) => void
  onReload: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const locale = useIntlLocale()
  if (error) {
    return (
      <div className="flex flex-col items-start gap-3 p-6">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={onReload}>
          {t('zotz.flows.retryLoad', 'Try again')}
        </Button>
      </div>
    )
  }
  if (loading && runs.length === 0) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {t('zotz.flows.loadingRuns', 'Loading runs')}
      </div>
    )
  }
  if (runs.length === 0) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        {t('zotz.flows.noRuns', 'This flow has not run yet.')}
      </p>
    )
  }
  return (
    <ul className="mx-auto flex w-full max-w-3xl flex-col gap-1 p-4">
      {runs.map((run) => {
        const [key, fallback] = ZOTZ_FLOW_STATUS_COPY[run.status]
        const trigger = ZOTZ_FLOW_TRIGGER_KINDS[run.trigger.kind]
        const duration =
          run.startedAt && run.finishedAt
            ? `${Math.max(0, Math.round((run.finishedAt - run.startedAt) / 1000))} s`
            : null
        return (
          <li key={run.id}>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              onClick={() => onOpen(run.id)}
            >
              <span className="w-14 shrink-0 font-mono text-muted-foreground">
                #{run.runNumber}
              </span>
              <span className={cn('w-40 shrink-0', 'flex')}>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    ZOTZ_FLOW_STATUS_CLASS[run.status].chip
                  )}
                >
                  {t(key, fallback)}
                </span>
              </span>
              <span className="min-w-0 flex-1 truncate">{t(...trigger.copy)}</span>
              <span className="shrink-0 text-muted-foreground">
                {formatAutomationDateTime(run.startedAt ?? run.createdAt, t, locale)}
                {duration ? ` · ${duration}` : ''}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
