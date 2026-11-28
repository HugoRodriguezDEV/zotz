import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import type { ZotzFlowTrigger } from '../../../../../shared/zotz/flows/zotz-flow-trigger-contract'
import {
  createZotzFlowTrigger,
  ZOTZ_FLOW_TRIGGER_KINDS,
  ZOTZ_FLOW_TRIGGER_ORDER
} from './zotz-flow-trigger-catalog'
import { ZotzFlowSection } from './ZotzFlowFormParts'
import { ZotzFlowTriggerFields } from './ZotzFlowTriggerFields'
import { newZotzFlowId } from './zotz-flow-graph-edits'

const NOT_LISTENING = new Set<ZotzFlowTrigger['kind']>([
  'agent_finished',
  'pull_request',
  'task_moved',
  'webhook',
  'chat_command'
])

export function ZotzFlowTriggerInspector({
  triggers,
  selectedId,
  onSelect,
  onChange
}: {
  triggers: ZotzFlowTrigger[]
  selectedId: string | null
  onSelect: (triggerId: string | null) => void
  onChange: (triggers: ZotzFlowTrigger[]) => void
}): React.JSX.Element {
  const t = useTranslate()
  const selected = triggers.find((trigger) => trigger.id === selectedId) ?? triggers[0] ?? null
  return (
    <div className="flex flex-col">
      <ZotzFlowSection
        title={t('zotz.flows.triggers', 'Triggers')}
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Plus />
                {t('zotz.flows.trigger.add', 'Add trigger')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {ZOTZ_FLOW_TRIGGER_ORDER.map((kind) => {
                const info = ZOTZ_FLOW_TRIGGER_KINDS[kind]
                const Icon = info.icon
                return (
                  <DropdownMenuItem
                    key={kind}
                    onSelect={() => {
                      const trigger = createZotzFlowTrigger(kind, newZotzFlowId())
                      onChange([...triggers, trigger])
                      onSelect(trigger.id)
                    }}
                  >
                    <Icon />
                    {t(...info.copy)}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        <div
          role="listbox"
          aria-label={t('zotz.flows.triggers', 'Triggers')}
          className="flex flex-col gap-0.5"
        >
          {triggers.map((trigger) => {
            const info = ZOTZ_FLOW_TRIGGER_KINDS[trigger.kind]
            const Icon = info.icon
            const current = trigger.id === selected?.id
            return (
              <button
                key={trigger.id}
                type="button"
                role="option"
                aria-selected={current}
                data-current={current || undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  current && 'bg-accent'
                )}
                onClick={() => onSelect(trigger.id)}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">{t(...info.copy)}</span>
              </button>
            )
          })}
        </div>
      </ZotzFlowSection>
      {selected ? (
        <ZotzFlowSection
          title={t(...ZOTZ_FLOW_TRIGGER_KINDS[selected.kind].copy)}
          action={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('zotz.flows.trigger.remove', 'Remove trigger')}
              onClick={() => {
                onChange(triggers.filter((trigger) => trigger.id !== selected.id))
                onSelect(null)
              }}
            >
              <Trash2 />
            </Button>
          }
        >
          {NOT_LISTENING.has(selected.kind) ? (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {t(
                'zotz.flows.trigger.notListening',
                'Zotz does not listen for this yet. It is saved and starts working when it does.'
              )}
            </p>
          ) : null}
          <ZotzFlowTriggerFields
            trigger={selected}
            onChange={(next) =>
              onChange(triggers.map((trigger) => (trigger.id === next.id ? next : trigger)))
            }
          />
        </ZotzFlowSection>
      ) : null}
    </div>
  )
}
