import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Workflow } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { ZotzFlow, ZotzFlowDraft } from '../../../../../shared/zotz/flows/zotz-flow-contract'
import type { ZotzFlowRun } from '../../../../../shared/zotz/flows/zotz-flow-run-contract'
import { zotzFlowsRpc } from './zotz-flows-rpc'
import { useZotzFlowsHosts } from './use-zotz-flows-hosts'
import { useZotzFlowsPageData } from './use-zotz-flows-page-data'
import { createZotzFlowDraft } from './zotz-flow-new-draft'
import { ZotzFlowsList } from './ZotzFlowsList'
import { ZotzFlowEditor } from './ZotzFlowEditor'
import { ZotzFlowRunsList } from './ZotzFlowRunsList'
import { ZotzFlowRunView } from './ZotzFlowRunView'
import { takeZotzFlowsPendingRun, useZotzFlowsPendingRun } from './zotz-flows-page-store'

type Open = { draft: ZotzFlowDraft; savedAt: number | null; key: number }
type RunsState = { flowId: string; runs: ZotzFlowRun[]; loading: boolean; error: string | null }

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default function ZotzFlowsPage(): React.JSX.Element {
  const t = useTranslate()
  const hosts = useZotzFlowsHosts()
  const [open, setOpen] = useState<Open | null>(null)
  const [tab, setTab] = useState<'editor' | 'runs'>('editor')
  const [runs, setRuns] = useState<RunsState | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<ZotzFlow | null>(null)

  const onRunEvent = useCallback((run: ZotzFlowRun) => {
    setRuns((current) =>
      current && current.flowId === run.flowId
        ? {
            ...current,
            runs: [run, ...current.runs.filter((item) => item.id !== run.id)].sort(
              (a, b) => b.runNumber - a.runNumber
            )
          }
        : current
    )
  }, [])
  const data = useZotzFlowsPageData(
    useMemo(() => hosts.map((host) => host.id), [hosts]),
    onRunEvent
  )
  const allFlows = useMemo(
    () => Object.values(data.byHost).flatMap((state) => state.flows),
    [data.byHost]
  )

  const loadRuns = useCallback((hostId: string, flowId: string) => {
    setRuns((current) => ({
      flowId,
      runs: current?.flowId === flowId ? current.runs : [],
      loading: true,
      error: null
    }))
    zotzFlowsRpc.runs(hostId, flowId).then(
      (page) => setRuns({ flowId, runs: page.runs, loading: false, error: null }),
      (error: unknown) =>
        setRuns((current) => ({
          flowId,
          runs: current?.runs ?? [],
          loading: false,
          error: message(error)
        }))
    )
  }, [])

  const pendingRun = useZotzFlowsPendingRun()
  useEffect(() => {
    const host = pendingRun ? data.byHost[pendingRun.hostId] : undefined
    if (!pendingRun || !host || host.loading) {
      return
    }
    takeZotzFlowsPendingRun(pendingRun)
    const { hostId, flowId, runId } = pendingRun
    const flow = host.flows.find((item) => item.id === flowId)
    if (!flow) {
      return
    }
    const show = (shown: RunsState, shownRunId: string | null): void => {
      setOpen({ draft: flow, savedAt: flow.updatedAt, key: Date.now() })
      setTab('runs')
      setRuns(shown)
      setRunId(shownRunId)
    }
    // The run may be older than the runs page, so it is fetched on its own and kept in the list.
    void Promise.all([zotzFlowsRpc.runGet(hostId, runId), zotzFlowsRpc.runs(hostId, flowId)]).then(
      ([{ run }, page]) =>
        show(
          {
            flowId,
            runs:
              run && !page.runs.some((item) => item.id === run.id)
                ? [run, ...page.runs]
                : page.runs,
            loading: false,
            error: null
          },
          run ? run.id : null
        ),
      (error: unknown) => show({ flowId, runs: [], loading: false, error: message(error) }, null)
    )
  }, [pendingRun, data.byHost])

  const openFlow = (draft: ZotzFlowDraft, savedAt: number | null): void => {
    setOpen({ draft, savedAt, key: Date.now() })
    setTab('editor')
    setRunId(null)
    setRuns(null)
  }

  if (!open) {
    return (
      <div className="flex min-h-0 flex-1 bg-background">
        <ZotzFlowsList
          hosts={hosts}
          byHost={data.byHost}
          onOpen={(flow) => openFlow(flow, flow.updatedAt)}
          onCreate={() =>
            openFlow(
              createZotzFlowDraft(
                t('zotz.flows.newName', 'New flow'),
                allFlows.map((flow) => flow.slug)
              ),
              null
            )
          }
          onDelete={setDeleting}
          onReload={data.load}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <Workflow className="size-8 text-muted-foreground" />
          <p className="max-w-sm text-sm text-muted-foreground">
            {t(
              'zotz.flows.intro',
              'A flow chains agents, commands and checks. Pick one on the left or create a new one.'
            )}
          </p>
        </div>
        <Dialog open={deleting !== null} onOpenChange={(next) => !next && setDeleting(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('zotz.flows.deleteTitle', 'Delete this flow?')}</DialogTitle>
              <DialogDescription>
                {t(
                  'zotz.flows.deleteBody',
                  '{name} and its run history are removed from its machine.'
                ).replace('{name}', () => deleting?.name ?? '')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDeleting(null)}>
                {t('zotz.flows.cancel', 'Cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  const flow = deleting
                  setDeleting(null)
                  if (flow) {
                    void zotzFlowsRpc
                      .delete(flow.hostId, flow.id)
                      .then(() => data.remove(flow.hostId, flow.id))
                  }
                }}
              >
                {t('zotz.flows.deleteConfirm', 'Delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  const hostId = open.draft.hostId
  const stored = allFlows.find((flow) => flow.id === open.draft.id)
  const activeRun = runId ? runs?.runs.find((run) => run.id === runId) : undefined
  const back = (): void => setOpen(null)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-2 py-1.5">
        <Button type="button" variant="ghost" size="sm" onClick={back}>
          <ArrowLeft />
          {t('zotz.flows.allFlows', 'All flows')}
        </Button>
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value === 'runs' ? 'runs' : 'editor')
            setRunId(null)
            if (value === 'runs' && open.savedAt !== null) {
              loadRuns(hostId, open.draft.id)
            }
          }}
        >
          <TabsList>
            <TabsTrigger value="editor">{t('zotz.flows.tabEditor', 'Editor')}</TabsTrigger>
            <TabsTrigger value="runs" disabled={open.savedAt === null && !stored}>
              {t('zotz.flows.tabRuns', 'Runs')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {tab === 'editor' ? (
        <ZotzFlowEditor
          key={open.key}
          initial={open.draft}
          savedAt={open.savedAt}
          hosts={hosts}
          flows={allFlows.map((flow) => ({
            id: flow.id,
            name: flow.name,
            inputs: flow.triggers.flatMap((trigger) =>
              trigger.kind === 'flow_call' ? trigger.inputs.map((input) => input.name) : []
            )
          }))}
          onSave={(draft, savedAt) => zotzFlowsRpc.save(draft.hostId, draft, savedAt)}
          onSaved={(flow) => {
            data.upsert(flow)
            setOpen((current) =>
              current ? { ...current, draft: flow, savedAt: flow.updatedAt } : current
            )
          }}
          onRun={async (flowId) => {
            const { run } = await zotzFlowsRpc.run(hostId, flowId)
            setRuns({ flowId, runs: [run], loading: false, error: null })
            setRunId(run.id)
            setTab('runs')
            loadRuns(hostId, flowId)
          }}
        />
      ) : activeRun ? (
        <ZotzFlowRunView
          flow={stored ?? open.draft}
          run={activeRun}
          onBack={() => setRunId(null)}
          actions={{
            approve: async (nodeId, iteration, decision) => {
              onRunEvent(
                (
                  await zotzFlowsRpc.approve(hostId, {
                    runId: activeRun.id,
                    nodeId,
                    iteration,
                    decision
                  })
                ).run
              )
            },
            cancel: async () => {
              const { run } = await zotzFlowsRpc.cancel(hostId, activeRun.id)
              if (run) {
                onRunEvent(run)
              }
            },
            retry: async (fromNodeId) => {
              const { run } = await zotzFlowsRpc.retry(hostId, activeRun.id, fromNodeId)
              onRunEvent(run)
              setRunId(run.id)
            }
          }}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-sleek">
          <ZotzFlowRunsList
            runs={runs?.runs ?? []}
            loading={runs?.loading ?? true}
            error={runs?.error ?? null}
            onOpen={setRunId}
            onReload={() => loadRuns(hostId, open.draft.id)}
          />
        </div>
      )}
    </div>
  )
}
