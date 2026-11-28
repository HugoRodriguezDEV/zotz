import React from 'react'
import { useTranslate } from '@/i18n/use-translate'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ZotzFlowField, ZotzFlowSection } from './ZotzFlowFormParts'
import { ZotzFlowTemplateInput } from './ZotzFlowTemplateInput'
import type { ZotzFlowKindFieldsProps } from './zotz-flow-inspector-types'
import { pickZotzFlowOption } from './zotz-flow-form-values'

// Steps that hold or call other steps: the loop and the subflow.

export function ZotzFlowForEachFields({
  node,
  onChange,
  options,
  fieldError
}: ZotzFlowKindFieldsProps<'for_each'>): React.JSX.Element {
  const t = useTranslate()
  return (
    <ZotzFlowSection title={t('zotz.flows.kind.forEach', 'For each')}>
      <ZotzFlowField
        label={t('zotz.flows.forEach.items', 'List')}
        error={fieldError('items')}
        hint={t(
          'zotz.flows.forEach.itemsHint',
          'A JSON array, or text with one item per line. Steps inside the loop read the item.'
        )}
      >
        {(id, describedBy) => (
          <ZotzFlowTemplateInput
            id={id}
            describedBy={describedBy}
            multiline={false}
            value={node.items}
            options={options}
            onChange={(items) => onChange((current) => ({ ...current, items }))}
          />
        )}
      </ZotzFlowField>
      <ToggleGroup
        type="single"
        spacing={1}
        size="sm"
        variant="segmented-card"
        value={node.order}
        aria-label={t('zotz.flows.forEach.order', 'Order')}
        onValueChange={(value) => {
          const order = pickZotzFlowOption(['parallel', 'sequential'] as const, value)
          if (order) {
            onChange((current) => ({ ...current, order }))
          }
        }}
      >
        <ToggleGroupItem value="parallel">
          {t('zotz.flows.forEach.parallel', 'All at once')}
        </ToggleGroupItem>
        <ToggleGroupItem value="sequential">
          {t('zotz.flows.forEach.sequential', 'One by one')}
        </ToggleGroupItem>
      </ToggleGroup>
      <ZotzFlowField label={t('zotz.flows.forEach.maxItems', 'Most items')}>
        {(id) => (
          <Input
            id={id}
            type="number"
            min={1}
            value={node.maxItems}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                maxItems: Math.max(1, Math.round(Number(event.target.value) || 1))
              }))
            }
          />
        )}
      </ZotzFlowField>
    </ZotzFlowSection>
  )
}

export type ZotzFlowSubflowTarget = { id: string; name: string; inputs: string[] }

export function ZotzFlowSubflowFields({
  node,
  onChange,
  options,
  flows
}: ZotzFlowKindFieldsProps<'subflow'> & {
  flows: readonly ZotzFlowSubflowTarget[]
}): React.JSX.Element {
  const t = useTranslate()
  const target = flows.find((flow) => flow.id === node.flowId)
  return (
    <ZotzFlowSection title={t('zotz.flows.kind.subflow', 'Subflow')}>
      <ZotzFlowField label={t('zotz.flows.subflow.flow', 'Flow to call')}>
        {(id) => (
          <Select
            value={node.flowId || undefined}
            onValueChange={(flowId) => onChange((current) => ({ ...current, flowId, inputs: {} }))}
          >
            <SelectTrigger id={id} className="w-full">
              <SelectValue placeholder={t('zotz.flows.subflow.choose', 'Choose a flow')} />
            </SelectTrigger>
            <SelectContent>
              {flows.map((flow) => (
                <SelectItem key={flow.id} value={flow.id}>
                  {flow.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </ZotzFlowField>
      {target?.inputs.map((name) => (
        <ZotzFlowField key={name} label={<span className="font-mono">{name}</span>}>
          {(id) => (
            <ZotzFlowTemplateInput
              id={id}
              multiline={false}
              value={node.inputs[name] ?? ''}
              options={options}
              onChange={(value) =>
                onChange((current) => ({
                  ...current,
                  inputs: { ...current.inputs, [name]: value }
                }))
              }
            />
          )}
        </ZotzFlowField>
      ))}
    </ZotzFlowSection>
  )
}
