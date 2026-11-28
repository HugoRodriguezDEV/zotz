import React, { useState } from 'react'
import { useTranslate } from '@/i18n/use-translate'
import {
  isValidAutomationSchedule,
  tryParseAutomationRrule
} from '../../../../../shared/automations/scheduling/automation-schedule-parsing'
import type { ZotzFlowTrigger } from '../../../../../shared/zotz/flows/zotz-flow-trigger-contract'
import { AutomationSchedulePicker } from '../../automations/authoring/AutomationSchedulePicker'
import type { AutomationDraft } from '../../automations/authoring/AutomationEditorDialog'
import {
  AUTOMATION_DEFAULT_TIME,
  buildDraftSchedule,
  formatTimeInput,
  parseDraftTime
} from '../../automations/authoring/automation-draft-model'
import { zotzFlowAgentToDraft } from './zotz-flow-agent-draft'
import { createZotzFlowNode } from './zotz-flow-node-catalog'

type ScheduleTrigger = Extract<ZotzFlowTrigger, { kind: 'schedule' }>

// The automation picker edits a whole AutomationDraft; only its schedule fields matter here.
const BLANK = zotzFlowAgentToDraft(
  createZotzFlowNode('agent', {
    id: 'schedule',
    name: 'schedule',
    position: { x: 0, y: 0 }
  })
)

function toDraft(trigger: ScheduleTrigger): AutomationDraft {
  const parsed = tryParseAutomationRrule(trigger.rrule)
  return {
    ...BLANK,
    preset: parsed?.preset ?? 'custom',
    time: parsed ? formatTimeInput(parsed.hour, parsed.minute) : AUTOMATION_DEFAULT_TIME,
    dayOfWeek: String(parsed?.dayOfWeek ?? 1),
    customSchedule: parsed ? '' : trigger.rrule,
    savedSchedule: trigger.rrule
  }
}

export function ZotzFlowScheduleTriggerFields({
  trigger,
  onChange
}: {
  trigger: ScheduleTrigger
  onChange: (trigger: ScheduleTrigger) => void
}): React.JSX.Element {
  const t = useTranslate()
  // Local draft so a half-typed custom cron survives; an outside change (undo) resets it.
  const [local, setLocal] = useState(() => ({ rrule: trigger.rrule, draft: toDraft(trigger) }))
  if (local.rrule !== trigger.rrule) {
    setLocal({ rrule: trigger.rrule, draft: toDraft(trigger) })
  }
  const draft = local.rrule === trigger.rrule ? local.draft : toDraft(trigger)
  return (
    <div className="flex flex-col gap-2">
      <AutomationSchedulePicker
        draft={draft}
        validateAdvancedSchedule={isValidAutomationSchedule}
        onDraftChange={(updater) => {
          const next = updater(draft)
          const { rrule } = buildDraftSchedule(next, parseDraftTime(next.time))
          // Keep the last valid rule while a custom cron is half typed.
          const valid = Boolean(rrule) && isValidAutomationSchedule(rrule)
          setLocal({ rrule: valid ? rrule : trigger.rrule, draft: next })
          if (valid && rrule !== trigger.rrule) {
            onChange({ ...trigger, rrule })
          }
        }}
      />
      <p className="text-xs text-muted-foreground">
        {t('zotz.flows.schedule.timezone', 'Time zone: {zone}').replace(
          '{zone}',
          () => trigger.timezone
        )}
      </p>
    </div>
  )
}
