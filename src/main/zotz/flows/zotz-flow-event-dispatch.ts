import type { ZotzFlow } from '../../../shared/zotz/flows/zotz-flow-contract'
import type { ZotzFlowTriggerPayload } from '../../../shared/zotz/flows/zotz-flow-run-contract'
import type { ZotzFlowTrigger } from '../../../shared/zotz/flows/zotz-flow-trigger-contract'
import type { ZotzFlowOriginMark, ZotzFlowRunOrigin } from './zotz-flow-origin'
import type { ZotzFlowStartResult } from './zotz-flow-service'

export type ZotzFlowEventKind = 'agent_finished' | 'pull_request' | 'task_moved' | 'webhook'
export type ZotzFlowEventTrigger<K extends ZotzFlowEventKind> = Extract<
  ZotzFlowTrigger,
  { kind: K }
>
export type ZotzFlowEventPayload<K extends ZotzFlowEventKind> = Extract<
  ZotzFlowTriggerPayload,
  { kind: K }
>

export type ZotzFlowEventDispatcher = {
  /** Whether some enabled flow listens to this kind of event. */
  wanted: (kind: ZotzFlowEventKind) => boolean
  /** Enabled triggers of this kind, for sources that need their filters (e.g. repos to poll). */
  triggers: <K extends ZotzFlowEventKind>(kind: K) => ZotzFlowEventTrigger<K>[]
  /** Whether an event with these facts would start any flow, before reading costly payload parts. */
  matches: <K extends ZotzFlowEventKind>(
    kind: K,
    accepts: (trigger: ZotzFlowEventTrigger<K>) => boolean
  ) => boolean
  /** Starts every enabled flow whose trigger accepts the event; the engine applies caps and the loop guard. */
  fire: <K extends ZotzFlowEventKind>(
    kind: K,
    payload: ZotzFlowEventPayload<K>,
    accepts: (trigger: ZotzFlowEventTrigger<K>) => boolean,
    causedBy: ZotzFlowOriginMark | null
  ) => ZotzFlowStartResult[]
}

function isKind<K extends ZotzFlowEventKind>(
  trigger: ZotzFlowTrigger,
  kind: K
): trigger is ZotzFlowEventTrigger<K> {
  return trigger.kind === kind
}

export function createZotzFlowEventDispatcher(input: {
  listFlows: () => readonly ZotzFlow[]
  start: (
    flowId: string,
    trigger: { triggerId: string } & ZotzFlowTriggerPayload,
    origin: ZotzFlowRunOrigin
  ) => ZotzFlowStartResult
}): ZotzFlowEventDispatcher {
  const listen = <K extends ZotzFlowEventKind>(kind: K) =>
    input
      .listFlows()
      .filter((flow) => flow.enabled)
      .flatMap((flow) =>
        flow.triggers.flatMap((trigger) => {
          const id = trigger.id
          return isKind(trigger, kind) ? [{ flow, trigger, id }] : []
        })
      )
  return {
    wanted: (kind) => listen(kind).length > 0,
    triggers: (kind) => listen(kind).map(({ trigger }) => trigger),
    matches: (kind, accepts) => listen(kind).some(({ trigger }) => accepts(trigger)),
    fire: (kind, payload, accepts, causedBy) =>
      listen(kind)
        .filter(({ trigger }) => accepts(trigger))
        // One run per flow and event, even when two of its triggers accept it.
        .filter(({ flow }, index, all) => all.findIndex((entry) => entry.flow === flow) === index)
        .map(({ flow, id }) => {
          const result = input.start(
            flow.id,
            { ...payload, triggerId: id },
            { source: 'event', causedBy }
          )
          if (!result.ok && result.reason !== 'loop_guard') {
            console.warn(`[zotz-flows] ${kind} did not start "${flow.name}": ${result.message}`)
          }
          return result
        })
  }
}
