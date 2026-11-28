import React, { useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { ZotzFlowDraft } from '../../../../../shared/zotz/flows/zotz-flow-contract'
import {
  ZOTZ_FLOW_MAX_RETRIES,
  ZOTZ_FLOW_ON_ERROR,
  type ZotzFlowNode,
  type ZotzFlowNodeKind,
  type ZotzFlowOnError
} from '../../../../../shared/zotz/flows/zotz-flow-node-contract'
import { ZOTZ_FLOW_NODE_KINDS } from './zotz-flow-node-catalog'
import { listZotzFlowTemplateOptions } from './zotz-flow-template-options'
import { describeZotzFlowProblem, type ZotzFlowCanvasProblem } from './zotz-flow-problems-view'
import type { ZotzFlowKindFieldsProps } from './zotz-flow-inspector-types'
import { ZotzFlowField, ZotzFlowSection } from './ZotzFlowFormParts'
import { pickZotzFlowOption, zotzFlowKindUpdater } from './zotz-flow-form-values'
import { ZotzFlowOutputFormatField } from './ZotzFlowOutputFormatField'
import { ZotzFlowConnectionsField } from './ZotzFlowConnectionsField'
import { ZotzFlowAgentFields } from './ZotzFlowAgentFields'
import {
  ZotzFlowChatReplyFields,
  ZotzFlowCommandFields,
  ZotzFlowHttpFields,
  ZotzFlowNotifyFields,
  ZotzFlowTemplateFields
} from './ZotzFlowActionFields'
import {
  ZotzFlowApprovalFields,
  ZotzFlowConditionFields,
  ZotzFlowJoinFields,
  ZotzFlowSwitchFields,
  ZotzFlowWaitFields
} from './ZotzFlowLogicFields'
import {
  ZotzFlowForEachFields,
  ZotzFlowSubflowFields,
  type ZotzFlowSubflowTarget
} from './ZotzFlowCompositeFields'

const ON_ERROR_COPY: Record<ZotzFlowOnError, [string, string]> = {
  stop: ['zotz.flows.onError.stop', 'Stop the flow'],
  continue: ['zotz.flows.onError.continue', 'Keep going'],
  error_port: ['zotz.flows.onError.errorPort', 'Leave by the Error output']
}

export type ZotzFlowNodeInspectorActions = {
  update: (nodeId: string, update: (node: ZotzFlowNode) => ZotzFlowNode) => void
  connect: (fromId: string, port: string, toId: string) => void
  removeEdge: (edgeId: string) => void
  setParent: (nodeId: string, parentId: string | undefined) => void
  remove: (nodeId: string) => void
}

function KindFields({
  node,
  props,
  hostId,
  hasChatTrigger,
  flows
}: {
  node: ZotzFlowNode
  props: Pick<ZotzFlowKindFieldsProps<ZotzFlowNodeKind>, 'options' | 'fieldError'> & {
    onChange: (update: (node: ZotzFlowNode) => ZotzFlowNode) => void
  }
  hostId: string
  hasChatTrigger: boolean
  flows: readonly ZotzFlowSubflowTarget[]
}): React.JSX.Element | null {
  const { options, fieldError } = props
  const common = { options, fieldError }
  // Each branch narrows `node`; the updater is typed to that kind.
  const on = <K extends ZotzFlowNodeKind>(kind: K) => zotzFlowKindUpdater(kind, props.onChange)
  switch (node.kind) {
    case 'agent':
      return (
        <ZotzFlowAgentFields
          node={node}
          hostId={hostId}
          hasChatTrigger={hasChatTrigger}
          options={options}
          onChange={on('agent')}
        />
      )
    case 'command':
      return <ZotzFlowCommandFields node={node} {...common} onChange={on('command')} />
    case 'http':
      return <ZotzFlowHttpFields node={node} {...common} onChange={on('http')} />
    case 'notify':
      return <ZotzFlowNotifyFields node={node} {...common} onChange={on('notify')} />
    case 'chat_reply':
      return <ZotzFlowChatReplyFields node={node} {...common} onChange={on('chat_reply')} />
    case 'template':
      return <ZotzFlowTemplateFields node={node} {...common} onChange={on('template')} />
    case 'condition':
      return <ZotzFlowConditionFields node={node} {...common} onChange={on('condition')} />
    case 'switch':
      return <ZotzFlowSwitchFields node={node} {...common} onChange={on('switch')} />
    case 'join':
      return <ZotzFlowJoinFields node={node} {...common} onChange={on('join')} />
    case 'approval':
      return <ZotzFlowApprovalFields node={node} {...common} onChange={on('approval')} />
    case 'wait':
      return <ZotzFlowWaitFields node={node} {...common} onChange={on('wait')} />
    case 'for_each':
      return <ZotzFlowForEachFields node={node} {...common} onChange={on('for_each')} />
    case 'subflow':
      return (
        <ZotzFlowSubflowFields node={node} {...common} onChange={on('subflow')} flows={flows} />
      )
    case 'parallel':
      return null
  }
}

export function ZotzFlowNodeInspector({
  node,
  draft,
  problems,
  flows,
  actions
}: {
  node: ZotzFlowNode
  draft: ZotzFlowDraft
  problems: readonly ZotzFlowCanvasProblem[]
  flows: readonly ZotzFlowSubflowTarget[]
  actions: ZotzFlowNodeInspectorActions
}): React.JSX.Element {
  const t = useTranslate()
  const options = useMemo(() => listZotzFlowTemplateOptions(draft, node.id), [draft, node.id])
  const own = problems.filter((problem) => problem.nodeId === node.id)
  const fieldError = (field: string): string | null => {
    const problem = own.find((candidate) => candidate.field === field)
    return problem ? describeZotzFlowProblem(problem, t) : null
  }
  const nameProblem = own.find(
    (problem) =>
      problem.code === 'duplicate_node_name' ||
      problem.code === 'reserved_node_name' ||
      (problem.code === 'invalid_field' && problem.field === 'name')
  )
  const onChange = (update: (node: ZotzFlowNode) => ZotzFlowNode): void =>
    actions.update(node.id, update)
  const kind = ZOTZ_FLOW_NODE_KINDS[node.kind]
  const hasChatTrigger = draft.triggers.some((trigger) => trigger.kind === 'chat_command')

  return (
    <div className="flex flex-col">
      <ZotzFlowSection title={t(...kind.copy)}>
        <ZotzFlowField
          label={t('zotz.flows.name', 'Name')}
          error={nameProblem ? describeZotzFlowProblem(nameProblem, t) : null}
          hint={t(
            'zotz.flows.nameHint',
            'Other steps read this step by its name. Letters, numbers and _.'
          )}
        >
          {(id, describedBy) => (
            <Input
              variant="code"
              id={id}
              value={node.name}
              aria-describedby={describedBy}
              aria-invalid={nameProblem ? true : undefined}
              onChange={(event) =>
                onChange((current) => ({ ...current, name: event.target.value }))
              }
            />
          )}
        </ZotzFlowField>
      </ZotzFlowSection>
      <KindFields
        node={node}
        hostId={draft.hostId}
        hasChatTrigger={hasChatTrigger}
        flows={flows}
        props={{ onChange, options, fieldError }}
      />
      {'output' in node ? (
        <ZotzFlowSection title={t('zotz.flows.output.format', 'Output format')}>
          <ZotzFlowOutputFormatField
            value={node.output}
            onChange={(output) =>
              onChange((current) => ('output' in current ? { ...current, output } : current))
            }
          />
        </ZotzFlowSection>
      ) : null}
      <ZotzFlowConnectionsField
        node={node}
        draft={draft}
        onConnect={(port, toId) => actions.connect(node.id, port, toId)}
        onDisconnect={actions.removeEdge}
        onSetParent={(parentId) => actions.setParent(node.id, parentId)}
      />
      <ZotzFlowSection title={t('zotz.flows.errors', 'If it fails')}>
        <ZotzFlowField label={t('zotz.flows.onErrorLabel', 'Then')}>
          {(id) => (
            <Select
              value={node.onError}
              onValueChange={(value) => {
                const onError = pickZotzFlowOption(ZOTZ_FLOW_ON_ERROR, value)
                if (onError) {
                  onChange((current) => ({ ...current, onError }))
                }
              }}
            >
              <SelectTrigger id={id} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZOTZ_FLOW_ON_ERROR.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(ON_ERROR_COPY[value][0], ON_ERROR_COPY[value][1])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </ZotzFlowField>
        <div className="flex gap-3">
          <ZotzFlowField label={t('zotz.flows.retries', 'Retries')} className="flex-1">
            {(id) => (
              <Select
                value={String(node.retries)}
                onValueChange={(retries) =>
                  onChange((current) => ({ ...current, retries: Number(retries) }))
                }
              >
                <SelectTrigger id={id} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: ZOTZ_FLOW_MAX_RETRIES + 1 }, (_, value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </ZotzFlowField>
          <ZotzFlowField label={t('zotz.flows.timeout', 'Time limit (s)')} className="flex-1">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={1}
                value={node.timeoutSeconds ?? ''}
                placeholder={t('zotz.flows.noLimit', 'None')}
                onChange={(event) => {
                  const seconds = Math.round(Number(event.target.value))
                  onChange((current) => {
                    const next = { ...current }
                    if (seconds > 0) {
                      next.timeoutSeconds = seconds
                    } else {
                      delete next.timeoutSeconds
                    }
                    return next
                  })
                }}
              />
            )}
          </ZotzFlowField>
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="self-start"
          onClick={() => actions.remove(node.id)}
        >
          <Trash2 />
          {t('zotz.flows.deleteStep', 'Delete step')}
        </Button>
      </ZotzFlowSection>
    </div>
  )
}
