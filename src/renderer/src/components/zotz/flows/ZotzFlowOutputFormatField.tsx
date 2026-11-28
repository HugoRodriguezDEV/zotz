import React, { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  ZOTZ_FLOW_JSON_FIELD_TYPES,
  type ZotzFlowJsonField,
  type ZotzFlowOutputFormat
} from '../../../../../shared/zotz/flows/zotz-flow-node-contract'
import { ZotzFlowField } from './ZotzFlowFormParts'
import { isPlainJsonObject, pickZotzFlowOption, useZotzFlowRowKeys } from './zotz-flow-form-values'

type JsonMode = 'fields' | 'schema'

function FieldsEditor({
  fields,
  onChange
}: {
  fields: ZotzFlowJsonField[]
  onChange: (fields: ZotzFlowJsonField[]) => void
}): React.JSX.Element {
  const t = useTranslate()
  const { entries, removeKey } = useZotzFlowRowKeys(fields)
  const update = (index: number, patch: Partial<ZotzFlowJsonField>): void =>
    onChange(fields.map((field, i) => (i === index ? { ...field, ...patch } : field)))
  return (
    <div className="flex flex-col gap-3">
      {entries.map(({ row: field, index, key }) => (
        <div key={key} className="flex flex-col gap-2 rounded-md border border-border p-2.5">
          <div className="flex items-center gap-2">
            <Input
              variant="code"
              value={field.name}
              aria-label={t('zotz.flows.output.fieldName', 'Field name')}
              placeholder={t('zotz.flows.output.fieldName', 'Field name')}
              className="h-8"
              onChange={(event) => update(index, { name: event.target.value })}
            />
            <Select
              value={field.type}
              onValueChange={(value) => {
                const type = pickZotzFlowOption(ZOTZ_FLOW_JSON_FIELD_TYPES, value)
                if (type) {
                  update(index, { type })
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
                {ZOTZ_FLOW_JSON_FIELD_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
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
                onChange(fields.filter((_, i) => i !== index))
              }}
            >
              <Trash2 />
            </Button>
          </div>
          <Input
            value={field.description ?? ''}
            aria-label={t('zotz.flows.output.fieldDescription', 'Description')}
            placeholder={t('zotz.flows.output.fieldDescription', 'Description')}
            className="h-8"
            onChange={(event) => update(index, { description: event.target.value || undefined })}
          />
          <label className="flex items-center gap-2 text-[13px]">
            <Switch
              checked={field.required}
              onCheckedChange={(required) => update(index, { required })}
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
            ...fields,
            { name: `field_${fields.length + 1}`, type: 'string', required: true }
          ])
        }
      >
        <Plus />
        {t('zotz.flows.output.addField', 'Add field')}
      </Button>
    </div>
  )
}

function SchemaEditor({
  schema,
  onChange
}: {
  schema: Record<string, unknown>
  onChange: (schema: Record<string, unknown>) => void
}): React.JSX.Element {
  const t = useTranslate()
  const [text, setText] = useState(() => JSON.stringify(schema, null, 2))
  const [error, setError] = useState<string | null>(null)
  return (
    <ZotzFlowField
      label={t('zotz.flows.output.schema', 'JSON Schema')}
      error={error}
      hint={t('zotz.flows.output.schemaHint', 'Paste a JSON Schema object.')}
    >
      {(id, describedBy) => (
        <Textarea
          variant="code"
          id={id}
          rows={8}
          value={text}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            setText(event.target.value)
            try {
              const parsed: unknown = JSON.parse(event.target.value)
              if (!isPlainJsonObject(parsed)) {
                throw new Error('not an object')
              }
              setError(null)
              onChange(parsed)
            } catch {
              setError(t('zotz.flows.output.schemaInvalid', 'This is not a JSON object yet.'))
            }
          }}
        />
      )}
    </ZotzFlowField>
  )
}

/** The Markdown/JSON switch of spec §4.4: JSON takes fields or a pasted schema. */
export function ZotzFlowOutputFormatField({
  value,
  onChange
}: {
  value: ZotzFlowOutputFormat
  onChange: (value: ZotzFlowOutputFormat) => void
}): React.JSX.Element {
  const t = useTranslate()
  const jsonMode: JsonMode | null =
    value.mode === 'json' ? ('fields' in value ? 'fields' : 'schema') : null
  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup
        type="single"
        spacing={1}
        size="sm"
        variant="segmented-card"
        value={value.mode}
        aria-label={t('zotz.flows.output.format', 'Output format')}
        onValueChange={(mode) => {
          if (mode === 'markdown') {
            onChange({ mode: 'markdown' })
          } else if (mode === 'json' && value.mode !== 'json') {
            onChange({ mode: 'json', fields: [{ name: 'result', type: 'string', required: true }] })
          }
        }}
      >
        <ToggleGroupItem value="markdown">
          {t('zotz.flows.output.markdown', 'Markdown')}
        </ToggleGroupItem>
        <ToggleGroupItem value="json">{t('zotz.flows.output.json', 'JSON')}</ToggleGroupItem>
      </ToggleGroup>
      {value.mode === 'json' ? (
        <>
          <ToggleGroup
            type="single"
            spacing={1}
            size="sm"
            variant="segmented-card"
            value={jsonMode ?? 'fields'}
            aria-label={t('zotz.flows.output.jsonMode', 'How to define the JSON')}
            onValueChange={(mode) => {
              if (mode === 'fields' && jsonMode !== 'fields') {
                onChange({
                  mode: 'json',
                  fields: [{ name: 'result', type: 'string', required: true }]
                })
              } else if (mode === 'schema' && jsonMode !== 'schema') {
                onChange({ mode: 'json', schema: { type: 'object', properties: {} } })
              }
            }}
          >
            <ToggleGroupItem value="fields">
              {t('zotz.flows.output.fields', 'Fields')}
            </ToggleGroupItem>
            <ToggleGroupItem value="schema">
              {t('zotz.flows.output.schema', 'JSON Schema')}
            </ToggleGroupItem>
          </ToggleGroup>
          {'fields' in value ? (
            <FieldsEditor
              fields={value.fields}
              onChange={(fields) => onChange({ mode: 'json', fields })}
            />
          ) : (
            <SchemaEditor
              schema={value.schema}
              onChange={(schema) => onChange({ mode: 'json', schema })}
            />
          )}
        </>
      ) : null}
    </div>
  )
}
