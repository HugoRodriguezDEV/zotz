import React from 'react'
import { Loader2, Plus, Trash2, Workflow } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import type { HostComboboxOption } from '@/components/host-picker/HostCombobox'
import type { ZotzFlow } from '../../../../../shared/zotz/flows/zotz-flow-contract'
import type { ZotzFlowsHostState } from './use-zotz-flows-page-data'

/** Flows grouped by the machine that stores them. */
export function ZotzFlowsList({
  hosts,
  byHost,
  onOpen,
  onCreate,
  onDelete,
  onReload
}: {
  hosts: readonly HostComboboxOption[]
  byHost: Readonly<Record<string, ZotzFlowsHostState>>
  onOpen: (flow: ZotzFlow) => void
  onCreate: () => void
  onDelete: (flow: ZotzFlow) => void
  onReload: (hostId: string) => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <h1 className="text-base font-semibold">{t('zotz.flows.title', 'Flows')}</h1>
        <Button type="button" size="sm" onClick={onCreate}>
          <Plus />
          {t('zotz.flows.new', 'New flow')}
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 pb-4 scrollbar-sleek">
        {hosts.map((host) => {
          const state = byHost[host.id]
          const flows = [...(state?.flows ?? [])].sort((a, b) => a.name.localeCompare(b.name))
          return (
            <section key={host.id} className="flex flex-col gap-0.5">
              <h2 className="px-2 pb-1 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
                {host.label}
              </h2>
              {state?.loading && flows.length === 0 ? (
                <p className="flex items-center gap-2 px-2 text-[13px] text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t('zotz.flows.loading', 'Loading flows')}
                </p>
              ) : null}
              {state?.error ? (
                <div className="flex flex-col items-start gap-1.5 px-2">
                  <p className="text-[13px] text-muted-foreground">
                    {t('zotz.flows.unavailable', 'Flows are not available on this machine.')}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onReload(host.id)}
                  >
                    {t('zotz.flows.retryLoad', 'Try again')}
                  </Button>
                </div>
              ) : null}
              {!state?.loading && !state?.error && flows.length === 0 ? (
                <p className="px-2 text-[13px] text-muted-foreground">
                  {t('zotz.flows.empty', 'No flows yet')}
                </p>
              ) : null}
              {flows.map((flow) => (
                <div key={flow.id} className="group flex items-center rounded-md hover:bg-accent">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    onClick={() => onOpen(flow)}
                  >
                    <Workflow className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{flow.name}</span>
                    {flow.enabled ? null : (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {t('zotz.flows.off', 'Off')}
                      </span>
                    )}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('zotz.flows.delete', 'Delete {name}').replace(
                      '{name}',
                      () => flow.name
                    )}
                    onClick={() => onDelete(flow)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </section>
          )
        })}
      </div>
    </aside>
  )
}
