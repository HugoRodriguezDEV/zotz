import React, { useEffect, useState } from 'react'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import type { AutomationRun } from '../../../../../shared/automations/history/automation-run'
import { formatAutomationDateTime } from '../../automations/automation-page-parts'
import { AutomationRunStatusLabel } from '../../automations/runs/AutomationRunStatusDot'
import { zotzFlowsTarget } from './zotz-flows-rpc'

const PAGE = 50

type Loaded = { key: string; runs: AutomationRun[]; error: string | null }

/** Runs of the automation a flow was migrated from (spec §8), read-only on the flow's machine. */
export function ZotzFlowAutomationRuns({
  hostId,
  automationId
}: {
  hostId: string
  automationId: string
}): React.JSX.Element | null {
  const t = useTranslate()
  const locale = useIntlLocale()
  const key = `${hostId}\n${automationId}`
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  useEffect(() => {
    const target = zotzFlowsTarget(hostId)
    if (!target) {
      return
    }
    let live = true
    callRuntimeRpc<{ runs: AutomationRun[] }>(target, 'automation.runs', {
      automationId,
      limit: PAGE
    }).then(
      ({ runs }) => live && setLoaded({ key, runs, error: null }),
      (error: unknown) =>
        live &&
        setLoaded({ key, runs: [], error: error instanceof Error ? error.message : String(error) })
    )
    return () => {
      live = false
    }
  }, [automationId, hostId, key])
  const current = loaded?.key === key ? loaded : null
  if (current && !current.error && current.runs.length === 0) {
    return null
  }
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-4 pb-6">
      <h3 className="px-3 pt-2 text-sm font-semibold">
        {t('zotz.flows.previousRuns.title', 'Earlier runs')}
      </h3>
      <p className="px-3 pb-1 text-xs text-muted-foreground">
        {t('zotz.flows.previousRuns.body', 'From the automation this flow came from. Read only.')}
      </p>
      {!current ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">
          {t('zotz.flows.loadingRuns', 'Loading runs')}
        </p>
      ) : current.error ? (
        <p className="px-3 py-2 text-sm text-destructive">{current.error}</p>
      ) : (
        <ul className="flex flex-col">
          {current.runs.map((run) => (
            <li key={run.id} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm">
              <AutomationRunStatusLabel status={run.status} className="w-40" />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {run.error ?? run.title}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {formatAutomationDateTime(run.startedAt ?? run.scheduledFor, t, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
