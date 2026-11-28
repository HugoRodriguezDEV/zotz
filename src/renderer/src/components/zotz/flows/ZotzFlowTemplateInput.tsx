import React, { useMemo, useRef, useState } from 'react'
import { Braces } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import type { ZotzFlowTemplateGroup, ZotzFlowTemplateOption } from './zotz-flow-template-options'

const GROUP_COPY: Record<ZotzFlowTemplateGroup, [string, string]> = {
  trigger: ['zotz.flows.templates.trigger', 'Trigger'],
  chat: ['zotz.flows.templates.chat', 'Chat'],
  item: ['zotz.flows.templates.item', 'Loop item'],
  node: ['zotz.flows.templates.steps', 'Earlier steps']
}

/** Button + searchable list of what this step can read; inserts `{{path}}`. */
export function ZotzFlowTemplatePicker({
  options,
  onInsert
}: {
  options: readonly ZotzFlowTemplateOption[]
  onInsert: (template: string) => void
}): React.JSX.Element {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  const groups = useMemo(() => {
    const map = new Map<string, ZotzFlowTemplateOption[]>()
    for (const option of options) {
      const key = option.group === 'node' ? `node:${option.source}` : option.group
      map.set(key, [...(map.get(key) ?? []), option])
    }
    return [...map.entries()]
  }, [options])
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Braces />
          {t('zotz.flows.templates.insert', 'Insert data')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <Command>
          <CommandInput placeholder={t('zotz.flows.templates.search', 'Search data')} />
          <CommandList>
            <CommandEmpty>
              {t('zotz.flows.templates.empty', 'Nothing available before this step')}
            </CommandEmpty>
            {groups.map(([key, items]) => {
              const first = items[0]
              const heading =
                first.group === 'node'
                  ? `${t(GROUP_COPY.node[0], GROUP_COPY.node[1])} · ${first.source}`
                  : t(GROUP_COPY[first.group][0], GROUP_COPY[first.group][1])
              return (
                <CommandGroup key={key} heading={heading}>
                  {items.map((option) => (
                    <CommandItem
                      key={option.path}
                      value={option.path}
                      onSelect={() => {
                        onInsert(`{{${option.path}}}`)
                        setOpen(false)
                      }}
                    >
                      <span className="font-mono">{option.path}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function insertAt(
  value: string,
  insert: string,
  element: HTMLInputElement | HTMLTextAreaElement | null
): string {
  const start = element?.selectionStart ?? value.length
  const end = element?.selectionEnd ?? value.length
  return value.slice(0, start) + insert + value.slice(end)
}

/** Text that accepts `{{ }}` templates, with the picker beside its label. */
export function ZotzFlowTemplateInput({
  id,
  value,
  onChange,
  options,
  multiline = true,
  placeholder,
  describedBy,
  invalid,
  ariaLabel
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  options: readonly ZotzFlowTemplateOption[]
  multiline?: boolean
  placeholder?: string
  describedBy?: string
  invalid?: boolean
  ariaLabel?: string
}): React.JSX.Element {
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null)
  const insert = (template: string): void => {
    onChange(insertAt(value, template, ref.current))
    requestAnimationFrame(() => ref.current?.focus())
  }
  const shared = {
    id,
    ref,
    value,
    placeholder,
    'aria-label': ariaLabel,
    'aria-describedby': describedBy,
    'aria-invalid': invalid || undefined,
    variant: 'code' as const
  }
  return (
    <div className="flex flex-col gap-1.5">
      {multiline ? (
        <Textarea {...shared} rows={4} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <Input {...shared} onChange={(event) => onChange(event.target.value)} />
      )}
      <div className="flex justify-end">
        <ZotzFlowTemplatePicker options={options} onInsert={insert} />
      </div>
    </div>
  )
}
