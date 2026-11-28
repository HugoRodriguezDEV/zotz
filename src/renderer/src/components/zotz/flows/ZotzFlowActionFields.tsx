import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ZOTZ_FLOW_HTTP_METHODS } from '../../../../../shared/zotz/flows/zotz-flow-node-contract'
import { ZotzFlowField, ZotzFlowSection } from './ZotzFlowFormParts'
import { ZotzFlowTemplateInput } from './ZotzFlowTemplateInput'
import type { ZotzFlowKindFieldsProps } from './zotz-flow-inspector-types'
import { pickZotzFlowOption, useZotzFlowRowKeys } from './zotz-flow-form-values'

type NameValue = { name: string; value: string }
const CHAT_REPLY_MODES = ['note', 'agent_message'] as const

function NameValueRows({
  rows,
  onChange,
  options,
  nameLabel,
  addLabel,
  namePrefix
}: {
  rows: NameValue[]
  onChange: (rows: NameValue[]) => void
  options: ZotzFlowKindFieldsProps<'command'>['options']
  nameLabel: string
  addLabel: string
  namePrefix?: string
}): React.JSX.Element {
  const t = useTranslate()
  const { entries, removeKey } = useZotzFlowRowKeys(rows)
  return (
    <div className="flex flex-col gap-3">
      {entries.map(({ row, index, key }) => (
        <div key={key} className="flex flex-col gap-1.5 rounded-md border border-border p-2.5">
          <div className="flex items-center gap-2">
            {namePrefix ? (
              <span className="font-mono text-xs text-muted-foreground">{namePrefix}</span>
            ) : null}
            <Input
              variant="code"
              value={row.name}
              aria-label={nameLabel}
              placeholder={nameLabel}
              className="h-8"
              onChange={(event) =>
                onChange(rows.map((r, i) => (i === index ? { ...r, name: event.target.value } : r)))
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('zotz.flows.remove', 'Remove')}
              onClick={() => {
                removeKey(index)
                onChange(rows.filter((_, i) => i !== index))
              }}
            >
              <Trash2 />
            </Button>
          </div>
          <ZotzFlowTemplateInput
            value={row.value}
            multiline={false}
            options={options}
            ariaLabel={t('zotz.flows.value', 'Value')}
            placeholder={t('zotz.flows.value', 'Value')}
            onChange={(value) => onChange(rows.map((r, i) => (i === index ? { ...r, value } : r)))}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => onChange([...rows, { name: `VALUE_${rows.length + 1}`, value: '' }])}
      >
        <Plus />
        {addLabel}
      </Button>
    </div>
  )
}

export function ZotzFlowCommandFields({
  node,
  onChange,
  options,
  fieldError
}: ZotzFlowKindFieldsProps<'command'>): React.JSX.Element {
  const t = useTranslate()
  const example = node.env[0]?.name ?? 'NAME'
  return (
    <ZotzFlowSection title={t('zotz.flows.kind.command', 'Command')}>
      <ZotzFlowField
        label={t('zotz.flows.command.text', 'Command')}
        error={fieldError('command')}
        hint={t(
          'zotz.flows.command.hint',
          'Data never goes into the command text. Read it from a variable: ${unix} on macOS and Linux, ${windows} on Windows.'
        )
          .replace('${unix}', `$ZOTZ_FLOW_${example}`)
          .replace('${windows}', `$env:ZOTZ_FLOW_${example}`)}
      >
        {(id, describedBy) => (
          <Textarea
            variant="code"
            id={id}
            rows={3}
            value={node.command}
            aria-describedby={describedBy}
            onChange={(event) =>
              onChange((current) => ({ ...current, command: event.target.value }))
            }
          />
        )}
      </ZotzFlowField>
      <ZotzFlowField label={t('zotz.flows.command.cwd', 'Folder (optional)')}>
        {(id) => (
          <Input
            variant="code"
            id={id}
            value={node.cwd ?? ''}
            onChange={(event) =>
              onChange((current) => ({ ...current, cwd: event.target.value || undefined }))
            }
          />
        )}
      </ZotzFlowField>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          {t('zotz.flows.command.env', 'Variables')}
        </span>
        <NameValueRows
          rows={node.env}
          options={options}
          namePrefix="ZOTZ_FLOW_"
          nameLabel={t('zotz.flows.command.envName', 'Variable name')}
          addLabel={t('zotz.flows.command.addEnv', 'Add variable')}
          onChange={(env) => onChange((current) => ({ ...current, env }))}
        />
      </div>
    </ZotzFlowSection>
  )
}

export function ZotzFlowHttpFields({
  node,
  onChange,
  options,
  fieldError
}: ZotzFlowKindFieldsProps<'http'>): React.JSX.Element {
  const t = useTranslate()
  return (
    <ZotzFlowSection title={t('zotz.flows.kind.http', 'HTTP request')}>
      <ZotzFlowField label={t('zotz.flows.http.method', 'Method')}>
        {(id) => (
          <Select
            value={node.method}
            onValueChange={(value) => {
              const method = pickZotzFlowOption(ZOTZ_FLOW_HTTP_METHODS, value)
              if (method) {
                onChange((current) => ({ ...current, method }))
              }
            }}
          >
            <SelectTrigger id={id} className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ZOTZ_FLOW_HTTP_METHODS.map((method) => (
                <SelectItem key={method} value={method}>
                  {method}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </ZotzFlowField>
      <ZotzFlowField label={t('zotz.flows.http.url', 'URL')} error={fieldError('url')}>
        {(id, describedBy) => (
          <ZotzFlowTemplateInput
            id={id}
            describedBy={describedBy}
            multiline={false}
            value={node.url}
            options={options}
            onChange={(url) => onChange((current) => ({ ...current, url }))}
          />
        )}
      </ZotzFlowField>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          {t('zotz.flows.http.headers', 'Headers')}
        </span>
        <NameValueRows
          rows={node.headers}
          options={options}
          nameLabel={t('zotz.flows.http.headerName', 'Header')}
          addLabel={t('zotz.flows.http.addHeader', 'Add header')}
          onChange={(headers) => onChange((current) => ({ ...current, headers }))}
        />
      </div>
      <ZotzFlowField label={t('zotz.flows.http.body', 'Body')} error={fieldError('body')}>
        {(id, describedBy) => (
          <ZotzFlowTemplateInput
            id={id}
            describedBy={describedBy}
            value={node.body ?? ''}
            options={options}
            onChange={(body) => onChange((current) => ({ ...current, body: body || undefined }))}
          />
        )}
      </ZotzFlowField>
    </ZotzFlowSection>
  )
}

export function ZotzFlowNotifyFields({
  node,
  onChange,
  options,
  fieldError
}: ZotzFlowKindFieldsProps<'notify'>): React.JSX.Element {
  const t = useTranslate()
  return (
    <ZotzFlowSection title={t('zotz.flows.kind.notify', 'Notify')}>
      <ZotzFlowField label={t('zotz.flows.notify.title', 'Title')} error={fieldError('title')}>
        {(id, describedBy) => (
          <ZotzFlowTemplateInput
            id={id}
            describedBy={describedBy}
            multiline={false}
            value={node.title}
            options={options}
            onChange={(title) => onChange((current) => ({ ...current, title }))}
          />
        )}
      </ZotzFlowField>
      <ZotzFlowField label={t('zotz.flows.notify.body', 'Message')} error={fieldError('body')}>
        {(id, describedBy) => (
          <ZotzFlowTemplateInput
            id={id}
            describedBy={describedBy}
            value={node.body}
            options={options}
            onChange={(body) => onChange((current) => ({ ...current, body }))}
          />
        )}
      </ZotzFlowField>
    </ZotzFlowSection>
  )
}

export function ZotzFlowChatReplyFields({
  node,
  onChange,
  options,
  fieldError
}: ZotzFlowKindFieldsProps<'chat_reply'>): React.JSX.Element {
  const t = useTranslate()
  return (
    <ZotzFlowSection title={t('zotz.flows.kind.chatReply', 'Reply in chat')}>
      <ToggleGroup
        type="single"
        spacing={1}
        size="sm"
        variant="segmented-card"
        value={node.mode}
        aria-label={t('zotz.flows.chatReply.mode', 'How to leave it')}
        onValueChange={(value) => {
          const mode = pickZotzFlowOption(CHAT_REPLY_MODES, value)
          if (mode) {
            onChange((current) => ({ ...current, mode }))
          }
        }}
      >
        <ToggleGroupItem value="note">{t('zotz.flows.chatReply.note', 'Note')}</ToggleGroupItem>
        <ToggleGroupItem value="agent_message">
          {t('zotz.flows.chatReply.agentMessage', 'Message to the agent')}
        </ToggleGroupItem>
      </ToggleGroup>
      <ZotzFlowField label={t('zotz.flows.content', 'Content')} error={fieldError('content')}>
        {(id, describedBy) => (
          <ZotzFlowTemplateInput
            id={id}
            describedBy={describedBy}
            value={node.content}
            options={options}
            onChange={(content) => onChange((current) => ({ ...current, content }))}
          />
        )}
      </ZotzFlowField>
    </ZotzFlowSection>
  )
}

export function ZotzFlowTemplateFields({
  node,
  onChange,
  options,
  fieldError
}: ZotzFlowKindFieldsProps<'template'>): React.JSX.Element {
  const t = useTranslate()
  return (
    <ZotzFlowSection title={t('zotz.flows.kind.template', 'Template')}>
      <ZotzFlowField label={t('zotz.flows.content', 'Content')} error={fieldError('content')}>
        {(id, describedBy) => (
          <ZotzFlowTemplateInput
            id={id}
            describedBy={describedBy}
            value={node.content}
            options={options}
            onChange={(content) => onChange((current) => ({ ...current, content }))}
          />
        )}
      </ZotzFlowField>
    </ZotzFlowSection>
  )
}
