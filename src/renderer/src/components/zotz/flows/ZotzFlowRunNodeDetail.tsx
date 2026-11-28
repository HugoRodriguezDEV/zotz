import React from 'react'
import { Check, RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/class-names'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import type { ZotzFlowNode } from '../../../../../shared/zotz/flows/zotz-flow-node-contract'
import type { ZotzFlowNodeRun } from '../../../../../shared/zotz/flows/zotz-flow-run-contract'
import { formatAutomationDateTime } from '../../automations/automation-page-parts'
import { ZOTZ_FLOW_NODE_KINDS } from './zotz-flow-node-catalog'
import { ZOTZ_FLOW_STATUS_CLASS, ZOTZ_FLOW_STATUS_COPY } from './zotz-flow-node-copy'
import { ZotzFlowSection } from './ZotzFlowFormParts'

function Block({ label, text }: { label: string; text: string }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <pre className="max-h-60 overflow-auto rounded-md border border-border bg-muted/40 p-2.5 font-mono text-[13px] whitespace-pre-wrap scrollbar-sleek">
        {text}
      </pre>
    </div>
  )
}

function seconds(from: number | null, to: number | null): string | null {
  return from && to ? `${Math.max(0, Math.round((to - from) / 1000))} s` : null
}

/** Inputs, output and controls of one step in a run; approval and retry act from here. */
export function ZotzFlowRunNodeDetail({
  node,
  nodeRun,
  busy,
  onApprove,
  onRetry
}: {
  node: ZotzFlowNode
  nodeRun: ZotzFlowNodeRun | null
  busy: boolean
  onApprove: (decision: 'approved' | 'rejected') => void
  onRetry: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const locale = useIntlLocale()
  const kind = ZOTZ_FLOW_NODE_KINDS[node.kind]
  const status = nodeRun?.status ?? 'pending'
  const [key, fallback] = ZOTZ_FLOW_STATUS_COPY[status]
  const output = nodeRun?.output
  const json =
    output?.json === undefined || output.json === null ? null : JSON.stringify(output.json, null, 2)
  const duration = seconds(nodeRun?.startedAt ?? null, nodeRun?.finishedAt ?? null)
  return (
    <div className="flex flex-col">
      <ZotzFlowSection title={t(...kind.copy)}>
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-mono text-base font-medium">
            {node.name}
          </span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              ZOTZ_FLOW_STATUS_CLASS[status].chip
            )}
          >
            {t(key, fallback)}
          </span>
        </div>
        {nodeRun?.startedAt ? (
          <p className="text-[13px] text-muted-foreground">
            {formatAutomationDateTime(nodeRun.startedAt, t, locale)}
            {duration ? ` · ${duration}` : ''}
            {nodeRun.attempts.length > 1
              ? ` · ${t('zotz.flows.run.attempts', '{count} attempts').replace('{count}', String(nodeRun.attempts.length))}`
              : ''}
          </p>
        ) : null}
        {nodeRun?.error ? <p className="text-sm text-destructive">{nodeRun.error}</p> : null}
        {status === 'waiting_approval' ? (
          <div className="flex flex-col gap-3 rounded-md border border-agent-question p-3">
            <p className="text-sm">
              {nodeRun?.inputs.message ||
                t('zotz.flows.run.approvalAsk', 'This step waits for your approval.')}
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={busy} onClick={() => onApprove('approved')}>
                <Check />
                {t('zotz.flows.run.approve', 'Approve')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => onApprove('rejected')}
              >
                <X />
                {t('zotz.flows.run.reject', 'Reject')}
              </Button>
            </div>
          </div>
        ) : null}
        {status === 'failed' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            disabled={busy}
            onClick={onRetry}
          >
            <RotateCcw />
            {t('zotz.flows.run.retryFromHere', 'Retry from this step')}
          </Button>
        ) : null}
      </ZotzFlowSection>
      {nodeRun && Object.keys(nodeRun.inputs).length > 0 ? (
        <ZotzFlowSection title={t('zotz.flows.run.inputs', 'Inputs')}>
          {Object.entries(nodeRun.inputs).map(([field, value]) => (
            <Block key={field} label={field} text={value} />
          ))}
        </ZotzFlowSection>
      ) : null}
      {output || nodeRun?.exitCode !== undefined ? (
        <ZotzFlowSection title={t('zotz.flows.run.output', 'Output')}>
          {nodeRun?.exitCode !== undefined && nodeRun.exitCode !== null ? (
            <p className="text-[13px]">
              {t('zotz.flows.run.exitCode', 'Exit code: {code}').replace(
                '{code}',
                String(nodeRun.exitCode)
              )}
            </p>
          ) : null}
          {nodeRun?.port ? (
            <p className="text-[13px] text-muted-foreground">
              {t('zotz.flows.run.port', 'Left by: {port}').replace(
                '{port}',
                () => nodeRun.port ?? ''
              )}
            </p>
          ) : null}
          {json ? <Block label={t('zotz.flows.output.json', 'JSON')} text={json} /> : null}
          {output?.markdown ? (
            <Block label={t('zotz.flows.output.markdown', 'Markdown')} text={output.markdown} />
          ) : null}
          {nodeRun?.stderr ? (
            <Block label={t('zotz.flows.run.stderr', 'Error output')} text={nodeRun.stderr} />
          ) : null}
          {output?.truncated ? (
            <p className="text-xs text-muted-foreground">
              {t('zotz.flows.run.truncated', 'The output was cut to fit.')}
            </p>
          ) : null}
        </ZotzFlowSection>
      ) : null}
    </div>
  )
}
