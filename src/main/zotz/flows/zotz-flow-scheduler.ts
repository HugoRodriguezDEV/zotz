import {
  latestAutomationOccurrenceAtOrBefore,
  nextAutomationOccurrenceAfter
} from '../../../shared/automations/scheduling/automation-schedule-occurrences'
import type { ZotzFlowRunTrigger } from '../../../shared/zotz/flows/zotz-flow-run-contract'
import type { ZotzFlowRunOrigin } from './zotz-flow-origin'
import type { ZotzFlowScheduleState, ZotzFlowStore } from './zotz-flow-store'

const TICK_MS = 30_000
// Same catch-up window automations default to: a run missed while asleep runs once within it.
const MISSED_RUN_GRACE_MS = 720 * 60 * 1000

/** Schedule triggers (spec §4.2), with the automation rrule, DST and missed-run rules. */
export function startZotzFlowScheduler(input: {
  store: ZotzFlowStore
  start: (flowId: string, trigger: ZotzFlowRunTrigger, origin: ZotzFlowRunOrigin) => void
  /** False right after a wake, so a dark wake never starts agents. */
  settled: () => boolean
  now: () => number
}): () => void {
  const { store } = input
  const tick = (): void => {
    if (!input.settled()) {
      return
    }
    const now = input.now()
    const previous = store.getSchedules()
    const next: ZotzFlowScheduleState = {}
    for (const flow of store.listFlows()) {
      for (const trigger of flow.triggers) {
        if (trigger.kind !== 'schedule') {
          continue
        }
        const key = `${flow.id}:${trigger.id}`
        const signature = `${trigger.rrule}|${trigger.dtstart}`
        const entry = previous[key]
        try {
          // A new or edited schedule starts from its next occurrence, never from the past.
          if (!entry || entry.signature !== signature) {
            next[key] = {
              nextRunAt: nextAutomationOccurrenceAfter(trigger.rrule, trigger.dtstart, now),
              signature
            }
            continue
          }
          if (entry.nextRunAt > now) {
            next[key] = entry
            continue
          }
          const scheduledFor = latestAutomationOccurrenceAtOrBefore(
            trigger.rrule,
            trigger.dtstart,
            now
          )
          if (flow.enabled && scheduledFor !== null && now - scheduledFor <= MISSED_RUN_GRACE_MS) {
            input.start(
              flow.id,
              { triggerId: trigger.id, kind: 'schedule', scheduledFor },
              { source: 'schedule' }
            )
          }
          next[key] = {
            nextRunAt: nextAutomationOccurrenceAfter(trigger.rrule, trigger.dtstart, now),
            signature
          }
        } catch (error) {
          console.warn(`[zotz-flows] schedule of "${flow.name}" cannot be read:`, error)
        }
      }
    }
    if (JSON.stringify(next) !== JSON.stringify(previous)) {
      store.setSchedules(next)
    }
  }
  tick()
  const timer = setInterval(tick, TICK_MS)
  timer.unref?.()
  const unsubscribe = store.subscribe((event) => {
    if (event.type !== 'run') {
      tick()
    }
  })
  return () => {
    clearInterval(timer)
    unsubscribe()
  }
}
