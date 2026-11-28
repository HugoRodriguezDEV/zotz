import React, { useCallback, useMemo, useState } from 'react'
import { ArrowLeft, CircleStop, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/class-names'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import type { ZotzFlowDraft } from '../../../../../shared/zotz/flows/zotz-flow-contract'
import {
  isFinalZotzFlowRunStatus,
  type ZotzFlowRun
} from '../../../../../shared/zotz/flows/zotz-flow-run-contract'
import { formatAutomationDateTime } from '../../automations/automation-page-parts'
import { ZotzFlowCanvas } from './ZotzFlowCanvas'
import { runZotzFlowBusyAction } from './zotz-flow-busy-action'
import { indexZotzFlowNodes, zotzFlowParentChain } from './zotz-flow-canvas-geometry'
import { ZotzFlowRunNodeDetail } from './ZotzFlowRunNodeDetail'
import { ZOTZ_FLOW_TRIGGER_KINDS } from './zotz-flow-trigger-catalog'
import { ZOTZ_FLOW_STATUS_CLASS, ZOTZ_FLOW_STATUS_COPY } from './zotz-flow-node-copy'
import type { ZotzFlowSelection } from './use-zotz-flow-editor-state'
import type { ZotzFlowLoopPicker, ZotzFlowNodeRunView } from './zotz-flow-canvas-model'
import {
  findZotzFlowNodeRun,
  zotzFlowIterationPath,
  zotzFlowLoopProgress,
  type ZotzFlowIterationChoice
} from './zotz-flow-run-view-model'

export type ZotzFlowRunActions = {
  approve: (nodeId: string, iteration: number[], decision: 'approved' | 'rejected') => Promise<void>
  cancel: () => Promise<void>
  retry: (fromNodeId?: string) => Promise<void>
}

/** The flow's canvas, read-only, colored by each step's state in this run. */
export function ZotzFlowRunView({
  flow,
  run,
  actions,
  onBack
}: {
  flow: Pick<ZotzFlowDraft, 'nodes' | 'edges' | 'triggers'>
  run: ZotzFlowRun
  actions: ZotzFlowRunActions
  onBack?: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const locale = useIntlLocale()
  const [selection, setSelection] = useState<ZotzFlowSelection>(null)
  const [choice, setChoice] = useState<ZotzFlowIterationChoice>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const act = useCallback(async (action: () => Promise<void>) => {
    setError(null)
    const outcome = await runZotzFlowBusyAction(setBusy, action)
    if (!outcome.ok) {
      setError(outcome.error)
    }
  }, [])

  const decor = useMemo(() => {
    const runOf = (nodeId: string): ZotzFlowNodeRunView | null => {
      const node = flow.nodes.find((candidate) => candidate.id === nodeId)
      const nodeRun = node ? findZotzFlowNodeRun(run, node, flow.nodes, choice) : null
      if (!nodeRun) {
        return node ? { status: 'pending' } : null
      }
      const progress = zotzFlowLoopProgress(nodeRun)
      return {
        status: nodeRun.status,
        ...(progress
          ? {
              progress:
                progress.failed > 0
                  ? t('zotz.flows.run.progressFailed', '{done}/{total} · {failed} failed')
                      .replace('{done}', String(progress.finished))
                      .replace('{total}', String(progress.total))
                      .replace('{failed}', String(progress.failed))
                  : `${progress.finished}/${progress.total}`
            }
          : {})
      }
    }
    const loopPicker = (nodeId: string): ZotzFlowLoopPicker | undefined => {
      const node = flow.nodes.find((candidate) => candidate.id === nodeId)
      const progress = node
        ? zotzFlowLoopProgress(findZotzFlowNodeRun(run, node, flow.nodes, choice))
        : null
      return progress
        ? {
            total: progress.total,
            selected: choice[nodeId] ?? 0,
            failed: progress.failedItems,
            onSelect: (index) => setChoice((current) => ({ ...current, [nodeId]: index }))
          }
        : undefined
    }
    return { run: runOf, loopPicker }
  }, [flow.nodes, run, choice, t])

  const selectedNode =
    selection?.kind === 'node' ? flow.nodes.find((node) => node.id === selection.id) : undefined
  const final = isFinalZotzFlowRunStatus(run.status)
  const [statusKey, statusFallback] = ZOTZ_FLOW_STATUS_COPY[run.status]
  const trigger = ZOTZ_FLOW_TRIGGER_KINDS[run.trigger.kind]
  const failedNode = run.nodes.find((entry) => entry.status === 'failed')

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
        {onBack ? (
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft />
            {t('zotz.flows.run.backToRuns', 'Runs')}
          </Button>
        ) : null}
        <h2 className="text-base font-medium">
          {t('zotz.flows.run.title', 'Run #{n}').replace('{n}', String(run.runNumber))}
        </h2>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            ZOTZ_FLOW_STATUS_CLASS[run.status].chip
          )}
        >
          {t(statusKey, statusFallback)}
        </span>
        <span className="text-[13px] text-muted-foreground">
          {t(...trigger.copy)} ·{' '}
          {formatAutomationDateTime(run.startedAt ?? run.createdAt, t, locale)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {error ? <span className="text-sm text-destructive">{error}</span> : null}
          {!final ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void act(actions.cancel)}
            >
              <CircleStop />
              {t('zotz.flows.run.cancel', 'Cancel run')}
            </Button>
          ) : null}
          {run.status === 'failed' ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void act(() => actions.retry())}
            >
              <RotateCcw />
              {t('zotz.flows.run.retry', 'Retry')}
            </Button>
          ) : null}
        </div>
      </div>
      {run.error ? (
        <p className="border-b border-border px-4 py-2 text-sm text-destructive">{run.error}</p>
      ) : null}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <ZotzFlowCanvas
            graph={flow}
            selection={selection}
            onSelect={setSelection}
            decor={decor}
            ariaLabel={t('zotz.flows.run.canvas', 'Run canvas')}
          />
        </div>
        <aside
          aria-label={t('zotz.flows.run.detail', 'Step detail')}
          className="flex w-[340px] shrink-0 flex-col overflow-y-auto border-l border-border bg-card scrollbar-sleek"
        >
          {selectedNode ? (
            <ZotzFlowRunNodeDetail
              node={selectedNode}
              nodeRun={findZotzFlowNodeRun(run, selectedNode, flow.nodes, choice)}
              busy={busy}
              onApprove={(decision) =>
                void act(() =>
                  actions.approve(
                    selectedNode.id,
                    zotzFlowIterationPath(selectedNode, flow.nodes, choice),
                    decision
                  )
                )
              }
              onRetry={() => void act(() => actions.retry(selectedNode.id))}
            />
          ) : (
            <div className="flex flex-col gap-2 p-4 text-sm text-muted-foreground">
              <p>
                {t(
                  'zotz.flows.run.pickStep',
                  'Select a step to see what went in and what came out.'
                )}
              </p>
              {failedNode ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => {
                    const node = flow.nodes.find((candidate) => candidate.id === failedNode.nodeId)
                    const loops = node
                      ? zotzFlowParentChain(node, indexZotzFlowNodes(flow.nodes)).toReversed()
                      : []
                    setChoice((current) =>
                      loops.reduce(
                        (next, loop, depth) => ({
                          ...next,
                          [loop.id]: failedNode.iteration[depth] ?? 0
                        }),
                        current
                      )
                    )
                    setSelection({ kind: 'node', id: failedNode.nodeId })
                  }}
                >
                  {t('zotz.flows.run.showFailed', 'Show the step that failed')}
                </Button>
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
