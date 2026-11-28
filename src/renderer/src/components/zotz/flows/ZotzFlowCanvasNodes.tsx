import React from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { AlertTriangle, CircleAlert, Zap } from 'lucide-react'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import { getZotzFlowNodePorts } from '../../../../../shared/zotz/flows/zotz-flow-node-contract'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ZOTZ_FLOW_NODE_KINDS } from './zotz-flow-node-catalog'
import { ZOTZ_FLOW_TRIGGER_KINDS } from './zotz-flow-trigger-catalog'
import {
  ZOTZ_FLOW_STATUS_CLASS,
  ZOTZ_FLOW_STATUS_COPY,
  zotzFlowNodeSummary,
  zotzFlowPortLabel
} from './zotz-flow-node-copy'
import {
  ZOTZ_FLOW_INPUT_HANDLE,
  type ZotzFlowStepData,
  type ZotzFlowTriggersData
} from './zotz-flow-canvas-model'

function MarkIcon({ mark }: { mark?: 'error' | 'warning' }): React.JSX.Element | null {
  const t = useTranslate()
  if (!mark) {
    return null
  }
  const Icon = mark === 'error' ? CircleAlert : AlertTriangle
  return (
    <Icon
      role="img"
      aria-label={
        mark === 'error'
          ? t('zotz.flows.mark.error', 'Has errors')
          : t('zotz.flows.mark.warning', 'Has warnings')
      }
      className={cn(
        'size-4 shrink-0',
        mark === 'error' ? 'text-destructive' : 'text-status-warning'
      )}
    />
  )
}

function StatusChip({ data }: { data: ZotzFlowStepData }): React.JSX.Element | null {
  const t = useTranslate()
  if (!data.run) {
    return null
  }
  const [key, fallback] = ZOTZ_FLOW_STATUS_COPY[data.run.status]
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
        ZOTZ_FLOW_STATUS_CLASS[data.run.status].chip
      )}
    >
      {data.run.progress ?? t(key, fallback)}
    </span>
  )
}

function OutputHandles({
  data,
  editable
}: {
  data: ZotzFlowStepData
  editable: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const ports = getZotzFlowNodePorts(data.node)
  return (
    <div className="flex flex-col items-end gap-1">
      {ports.map((port) => {
        const label = zotzFlowPortLabel(data.node, port, t)
        return (
          <div key={port} className="relative flex min-h-5 items-center pr-3">
            {label ? <span className="text-[13px] text-muted-foreground">{label}</span> : null}
            <Handle
              type="source"
              id={port}
              position={Position.Right}
              isConnectable={editable}
              className="zotz-flow-handle"
              aria-label={label || t('zotz.flows.port.output', 'Output')}
            />
          </div>
        )
      })}
    </div>
  )
}

function borderClass(data: ZotzFlowStepData, selected: boolean): string {
  if (data.run) {
    return ZOTZ_FLOW_STATUS_CLASS[data.run.status].border
  }
  if (data.mark === 'error') {
    return 'border-destructive'
  }
  if (data.mark === 'warning') {
    return 'border-status-warning-border'
  }
  return selected ? 'border-ring' : 'border-border'
}

export function ZotzFlowStepNode({
  data,
  selected,
  isConnectable
}: NodeProps<Node<ZotzFlowStepData>>): React.JSX.Element {
  const t = useTranslate()
  const kind = ZOTZ_FLOW_NODE_KINDS[data.node.kind]
  const Icon = kind.icon
  const summary = zotzFlowNodeSummary(data.node, t)
  return (
    <div
      className={cn(
        'relative w-[220px] rounded-lg border-2 bg-card text-card-foreground shadow-xs',
        borderClass(data, selected),
        selected && 'ring-2 ring-ring ring-offset-2 ring-offset-background'
      )}
    >
      <Handle
        type="target"
        id={ZOTZ_FLOW_INPUT_HANDLE}
        position={Position.Left}
        isConnectable={isConnectable}
        className="zotz-flow-handle"
      />
      <div className="flex items-start gap-2 px-3 pt-2.5">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-[15px] font-medium">{data.node.name}</div>
          <div className="text-[13px] text-muted-foreground">{t(...kind.copy)}</div>
        </div>
        <MarkIcon mark={data.mark} />
        <StatusChip data={data} />
      </div>
      <div className="flex items-end justify-between gap-2 pb-2 pl-3">
        <p className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">{summary}</p>
        <OutputHandles data={data} editable={isConnectable} />
      </div>
    </div>
  )
}

export function ZotzFlowLoopNode({
  data,
  selected,
  isConnectable
}: NodeProps<Node<ZotzFlowStepData>>): React.JSX.Element {
  const t = useTranslate()
  const Icon = ZOTZ_FLOW_NODE_KINDS.for_each.icon
  const picker = data.loopPicker
  return (
    <div
      className={cn(
        'relative size-full rounded-xl border-2 border-dashed bg-muted/30',
        borderClass(data, selected),
        selected && 'ring-2 ring-ring ring-offset-2 ring-offset-background'
      )}
    >
      <Handle
        type="target"
        id={ZOTZ_FLOW_INPUT_HANDLE}
        position={Position.Left}
        isConnectable={isConnectable}
        className="zotz-flow-handle"
        style={{ top: 28 }}
      />
      <div className="flex flex-col gap-1.5 border-b border-border/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-mono text-[15px] font-medium">{data.node.name}</span>
          <span className="shrink-0 text-[13px] text-muted-foreground">
            {t(...ZOTZ_FLOW_NODE_KINDS.for_each.copy)}
          </span>
          <span className="flex-1" />
          <MarkIcon mark={data.mark} />
        </div>
        {data.run ? (
          <div className="flex items-center gap-2">
            <StatusChip data={data} />
            {picker && picker.total > 0 ? (
              // nodrag/nopan: React Flow leaves pointer events inside to the picker.
              <div className="nodrag nopan">
                <Select
                  value={String(picker.selected)}
                  onValueChange={(value) => picker.onSelect(Number(value))}
                >
                  <SelectTrigger size="sm" aria-label={t('zotz.flows.run.iteration', 'Item')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: picker.total }, (_, item) => item).map((item) => (
                      <SelectItem key={item} value={String(item)}>
                        {t('zotz.flows.run.iterationN', 'Item {n}').replace(
                          '{n}',
                          String(item + 1)
                        )}
                        {picker.failed.has(item)
                          ? ` · ${t('zotz.flows.status.failed', 'Failed')}`
                          : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="truncate text-[13px] text-muted-foreground">
            {zotzFlowNodeSummary(data.node, t)}
          </p>
        )}
      </div>
      <div className="absolute right-0 bottom-2">
        <OutputHandles data={data} editable={isConnectable} />
      </div>
    </div>
  )
}

export function ZotzFlowTriggersNode({
  data,
  selected
}: NodeProps<Node<ZotzFlowTriggersData>>): React.JSX.Element {
  const t = useTranslate()
  return (
    <div
      className={cn(
        'w-[220px] rounded-lg border-2 bg-card text-card-foreground shadow-xs',
        selected
          ? 'border-ring ring-2 ring-ring ring-offset-2 ring-offset-background'
          : 'border-border'
      )}
    >
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        <Zap className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-[15px] font-medium">{t('zotz.flows.triggers', 'Triggers')}</span>
      </div>
      <div className="flex flex-col gap-0.5 px-1.5 pb-2">
        {data.triggers.length === 0 ? (
          <p className="px-1.5 text-xs text-muted-foreground">
            {t('zotz.flows.triggersEmpty', 'Runs only by hand')}
          </p>
        ) : null}
        {data.triggers.map((trigger) => {
          const info = ZOTZ_FLOW_TRIGGER_KINDS[trigger.kind]
          const Icon = info.icon
          return (
            <button
              key={trigger.id}
              type="button"
              className={cn(
                'nodrag flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                data.selectedTriggerId === trigger.id && 'bg-accent'
              )}
              onClick={(event) => {
                event.stopPropagation()
                data.onSelectTrigger(trigger.id)
              }}
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{t(...info.copy)}</span>
              <MarkIcon mark={data.marks.get(trigger.id)} />
            </button>
          )
        })}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="zotz-flow-handle"
      />
    </div>
  )
}

export const ZOTZ_FLOW_NODE_TYPES = {
  step: ZotzFlowStepNode,
  loop: ZotzFlowLoopNode,
  triggers: ZotzFlowTriggersNode
}
