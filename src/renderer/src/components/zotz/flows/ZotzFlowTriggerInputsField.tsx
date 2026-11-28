import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type {
  ZotzFlowInputField,
  ZotzFlowInputFieldType
} from '../../../../../shared/zotz/flows/zotz-flow-trigger-contract'
import { pickZotzFlowOption, useZotzFlowRowKeys } from './zotz-flow-form-values'

const TYPE_COPY: Record<ZotzFlowInputFieldType, [string, string]> = {
  text: ['zotz.flows.input.text', 'Text'],
  number: ['zotz.flows.input.number', 'Number'],
  boolean: ['zotz.flows.input.boolean', 'Yes / no'],
  select: ['zotz.flows.input.select', 'Choice']
}

const INPUT_TYPES = [
  'text',
  'number',
  'boolean',
  'select'
] as const satisfies readonly ZotzFlowInputFieldType[]

function retype(field: ZotzFlowInputField, type: ZotzFlowInputFieldType): ZotzFlowInputField {
  const base = { name: field.name, label: field.label, required: field.required }
  return type === 'select' ? { ...base, type, options: ['a', 'b'] } : { ...base, type }
}

/** Fields a manual run, chat command or calling flow fills in; they arrive as `trigger.inputs`. */
export function ZotzFlowTriggerInputsField({
  inputs,
  onChange
}: {
  inputs: ZotzFlowInputField[]
  onChange: (inputs: ZotzFlowInputField[]) => void
}): React.JSX.Element {
  const t = useTranslate()
  const { entries, removeKey } = useZotzFlowRowKeys(inputs)
  const update = (index: number, field: ZotzFlowInputField): void =>
    onChange(inputs.map((current, i) => (i === index ? field : current)))
  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium text-muted-foreground">
        {t('zotz.flows.input.title', 'Input fields')}
      </span>
      {entries.map(({ row: field, index, key }) => (
        <div key={key} className="flex flex-col gap-2 rounded-md border border-border p-2.5">
          <div className="flex items-center gap-2">
            <Input
              variant="code"
              value={field.name}
              aria-label={t('zotz.flows.output.fieldName', 'Field name')}
              placeholder={t('zotz.flows.output.fieldName', 'Field name')}
              className="h-8"
              onChange={(event) => update(index, { ...field, name: event.target.value })}
            />
            <Select
              value={field.type}
              onValueChange={(value) => {
                const type = pickZotzFlowOption(INPUT_TYPES, value)
                if (type) {
                  update(index, retype(field, type))
                }
              }}
            >
              <SelectTrigger
                size="sm"
                className="w-28 shrink-0"
                aria-label={t('zotz.flows.output.fieldType', 'Type')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INPUT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(TYPE_COPY[type][0], TYPE_COPY[type][1])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('zotz.flows.output.removeField', 'Remove field')}
              onClick={() => {
                removeKey(index)
                onChange(inputs.filter((_, i) => i !== index))
              }}
            >
              <Trash2 />
            </Button>
          </div>
          <Input
            value={field.label ?? ''}
            aria-label={t('zotz.flows.input.label', 'Label shown in the form')}
            placeholder={t('zotz.flows.input.label', 'Label shown in the form')}
            className="h-8"
            onChange={(event) =>
              update(index, { ...field, label: event.target.value || undefined })
            }
          />
          {field.type === 'select' ? (
            <Input
              value={field.options.join(', ')}
              aria-label={t('zotz.flows.input.options', 'Choices, separated by commas')}
              placeholder={t('zotz.flows.input.options', 'Choices, separated by commas')}
              className="h-8"
              onChange={(event) =>
                update(index, {
                  ...field,
                  options: event.target.value
                    .split(',')
                    .map((option) => option.trim())
                    .filter(Boolean)
                })
              }
            />
          ) : null}
          <label className="flex items-center gap-2 text-[13px]">
            <Switch
              checked={field.required}
              onCheckedChange={(required) => update(index, { ...field, required })}
            />
            {t('zotz.flows.output.required', 'Required')}
          </label>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() =>
          onChange([
            ...inputs,
            { name: `input_${inputs.length + 1}`, type: 'text', required: false }
          ])
        }
      >
        <Plus />
        {t('zotz.flows.input.add', 'Add field')}
      </Button>
    </div>
  )
}
