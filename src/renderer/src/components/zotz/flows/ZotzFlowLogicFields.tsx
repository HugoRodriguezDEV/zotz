import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  ZOTZ_FLOW_CONDITION_OPERATORS,
  type ZotzFlowConditionOperator
} from '../../../../../shared/zotz/flows/zotz-flow-node-contract'
import { ZotzFlowField, ZotzFlowSection } from './ZotzFlowFormParts'
import { ZotzFlowTemplateInput } from './ZotzFlowTemplateInput'
import type { ZotzFlowKindFieldsProps } from './zotz-flow-inspector-types'
import { pickZotzFlowOption, useZotzFlowRowKeys } from './zotz-flow-form-values'

const OPERATOR_COPY: Record<ZotzFlowConditionOperator, [string, string]> = {
  equals: ['zotz.flows.operator.equals', 'is equal to'],
  not_equals: ['zotz.flows.operator.notEquals', 'is not equal to'],
  contains: ['zotz.flows.operator.contains', 'contains'],
  not_contains: ['zotz.flows.operator.notContains', 'does not contain'],
  greater_than: ['zotz.flows.operator.greaterThan', 'is greater than'],
  less_than: ['zotz.flows.operator.lessThan', 'is less than'],
  exists: ['zotz.flows.operator.exists', 'has a value'],
  not_exists: ['zotz.flows.operator.notExists', 'is empty'],
  exit_code_zero: ['zotz.flows.operator.exitCodeZero', 'exit code is 0']
}
const NO_COMPARE = new Set<ZotzFlowConditionOperator>(['exists', 'not_exists', 'exit_code_zero'])

export function ZotzFlowConditionFields({
  node,
  onChange,
  options,
  fieldError
}: ZotzFlowKindFieldsProps<'condition'>): React.JSX.Element {
  const t = useTranslate()
  return (
    <ZotzFlowSection title={t('zotz.flows.kind.condition', 'Condition')}>
      <ZotzFlowField label={t('zotz.flows.condition.value', 'Value')} error={fieldError('value')}>
        {(id, describedBy) => (
          <ZotzFlowTemplateInput
            id={id}
            describedBy={describedBy}
            multiline={false}
            value={node.value}
            options={options}
            onChange={(value) => onChange((current) => ({ ...current, value }))}
          />
        )}
      </ZotzFlowField>
      <ZotzFlowField label={t('zotz.flows.condition.operator', 'Check')}>
        {(id) => (
          <Select
            value={node.operator}
            onValueChange={(value) => {
              const operator = pickZotzFlowOption(ZOTZ_FLOW_CONDITION_OPERATORS, value)
              if (operator) {
                onChange((current) => ({ ...current, operator }))
              }
            }}
          >
            <SelectTrigger id={id} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ZOTZ_FLOW_CONDITION_OPERATORS.map((operator) => (
                <SelectItem key={operator} value={operator}>
                  {t(OPERATOR_COPY[operator][0], OPERATOR_COPY[operator][1])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </ZotzFlowField>
      {NO_COMPARE.has(node.operator) ? null : (
        <ZotzFlowField
          label={t('zotz.flows.condition.compareTo', 'Compared with')}
          error={fieldError('compareTo')}
        >
          {(id, describedBy) => (
            <ZotzFlowTemplateInput
              id={id}
              describedBy={describedBy}
              multiline={false}
              value={node.compareTo ?? ''}
              options={options}
              onChange={(compareTo) => onChange((current) => ({ ...current, compareTo }))}
            />
          )}
        </ZotzFlowField>
      )}
    </ZotzFlowSection>
  )
}

export function ZotzFlowSwitchFields({
  node,
  onChange,
  options,
  fieldError
}: ZotzFlowKindFieldsProps<'switch'>): React.JSX.Element {
  const t = useTranslate()
  const { entries, removeKey } = useZotzFlowRowKeys(node.cases)
  const setCases = (cases: typeof node.cases): void =>
    onChange((current) => ({ ...current, cases }))
  return (
    <ZotzFlowSection title={t('zotz.flows.kind.switch', 'Switch')}>
      <ZotzFlowField label={t('zotz.flows.condition.value', 'Value')} error={fieldError('value')}>
        {(id, describedBy) => (
          <ZotzFlowTemplateInput
            id={id}
            describedBy={describedBy}
            multiline={false}
            value={node.value}
            options={options}
            onChange={(value) => onChange((current) => ({ ...current, value }))}
          />
        )}
      </ZotzFlowField>
      {entries.map(({ row: entry, index, key }) => (
        <div key={key} className="flex items-end gap-2">
          <ZotzFlowField label={t('zotz.flows.switch.output', 'Output')} className="w-32 shrink-0">
            {(id) => (
              <Input
                variant="code"
                id={id}
                value={entry.port}
                className="h-9"
                onChange={(event) =>
                  setCases(
                    node.cases.map((c, i) => (i === index ? { ...c, port: event.target.value } : c))
                  )
                }
              />
            )}
          </ZotzFlowField>
          <ZotzFlowField label={t('zotz.flows.switch.equals', 'When it equals')} className="flex-1">
            {(id) => (
              <Input
                variant="code"
                id={id}
                value={entry.equals}
                className="h-9"
                onChange={(event) =>
                  setCases(
                    node.cases.map((c, i) =>
                      i === index ? { ...c, equals: event.target.value } : c
                    )
                  )
                }
              />
            )}
          </ZotzFlowField>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('zotz.flows.remove', 'Remove')}
            disabled={node.cases.length === 1}
            onClick={() => {
              removeKey(index)
              setCases(node.cases.filter((_, i) => i !== index))
            }}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() =>
          setCases([...node.cases, { port: `case_${node.cases.length + 1}`, equals: '' }])
        }
      >
        <Plus />
        {t('zotz.flows.switch.addCase', 'Add output')}
      </Button>
    </ZotzFlowSection>
  )
}

export function ZotzFlowJoinFields({
  node,
  onChange
}: ZotzFlowKindFieldsProps<'join'>): React.JSX.Element {
  const t = useTranslate()
  return (
    <ZotzFlowSection title={t('zotz.flows.kind.join', 'Join')}>
      <ToggleGroup
        type="single"
        spacing={1}
        size="sm"
        variant="segmented-card"
        value={node.waitFor}
        aria-label={t('zotz.flows.join.waitFor', 'Wait for')}
        onValueChange={(value) => {
          const waitFor = pickZotzFlowOption(['all', 'first'] as const, value)
          if (waitFor) {
            onChange((current) => ({ ...current, waitFor }))
          }
        }}
      >
        <ToggleGroupItem value="all">
          {t('zotz.flows.summary.joinAll', 'Waits for all')}
        </ToggleGroupItem>
        <ToggleGroupItem value="first">
          {t('zotz.flows.summary.joinFirst', 'Waits for the first')}
        </ToggleGroupItem>
      </ToggleGroup>
    </ZotzFlowSection>
  )
}

export function ZotzFlowApprovalFields({
  node,
  onChange,
  options,
  fieldError
}: ZotzFlowKindFieldsProps<'approval'>): React.JSX.Element {
  const t = useTranslate()
  return (
    <ZotzFlowSection title={t('zotz.flows.kind.approval', 'Approval')}>
      <ZotzFlowField
        label={t('zotz.flows.approval.message', 'Message for whoever approves')}
        error={fieldError('message')}
        hint={t(
          'zotz.flows.approval.timeoutHint',
          'Set a time limit below to get a "Timed out" output.'
        )}
      >
        {(id, describedBy) => (
          <ZotzFlowTemplateInput
            id={id}
            describedBy={describedBy}
            value={node.message}
            options={options}
            onChange={(message) => onChange((current) => ({ ...current, message }))}
          />
        )}
      </ZotzFlowField>
    </ZotzFlowSection>
  )
}

export function ZotzFlowWaitFields({
  node,
  onChange
}: ZotzFlowKindFieldsProps<'wait'>): React.JSX.Element {
  const t = useTranslate()
  const wait = node.wait
  return (
    <ZotzFlowSection title={t('zotz.flows.kind.wait', 'Wait')}>
      <ToggleGroup
        type="single"
        spacing={1}
        size="sm"
        variant="segmented-card"
        value={wait.mode}
        aria-label={t('zotz.flows.wait.mode', 'How long')}
        onValueChange={(mode) => {
          if (mode === 'duration' && wait.mode !== 'duration') {
            onChange((current) => ({ ...current, wait: { mode: 'duration', seconds: 60 } }))
          } else if (mode === 'until_time' && wait.mode !== 'until_time') {
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
            onChange((current) => ({
              ...current,
              wait: { mode: 'until_time', time: '09:00', timezone }
            }))
          }
        }}
      >
        <ToggleGroupItem value="duration">
          {t('zotz.flows.wait.duration', 'A while')}
        </ToggleGroupItem>
        <ToggleGroupItem value="until_time">
          {t('zotz.flows.wait.untilTime', 'Until a time')}
        </ToggleGroupItem>
      </ToggleGroup>
      {wait.mode === 'duration' ? (
        <ZotzFlowField label={t('zotz.flows.wait.seconds', 'Seconds')}>
          {(id) => (
            <Input
              id={id}
              type="number"
              min={1}
              value={wait.seconds}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  wait: {
                    mode: 'duration',
                    seconds: Math.max(1, Math.round(Number(event.target.value) || 1))
                  }
                }))
              }
            />
          )}
        </ZotzFlowField>
      ) : (
        <ZotzFlowField label={t('zotz.flows.wait.time', 'Time')} hint={wait.timezone}>
          {(id, describedBy) => (
            <Input
              id={id}
              type="time"
              value={wait.time}
              aria-describedby={describedBy}
              onChange={(event) =>
                onChange((current) => ({ ...current, wait: { ...wait, time: event.target.value } }))
              }
            />
          )}
        </ZotzFlowField>
      )}
    </ZotzFlowSection>
  )
}
