import type { z } from 'zod'
import { InvalidArgumentError } from '../../runtime/rpc/core'
import type { ZotzFlow } from '../../../shared/zotz/flows/zotz-flow-contract'
import type {
  ZotzFlowInputField,
  ZotzFlowInputValues
} from '../../../shared/zotz/flows/zotz-flow-trigger-contract'
import type { ZotzFlowRunTrigger } from '../../../shared/zotz/flows/zotz-flow-run-contract'
import type { ZotzFlowsRunParams } from '../../../shared/rpc-contract/zotz/zotz-flows-params'
import type { ZotzFlowRunOrigin } from './zotz-flow-origin'

type RawInputs = Record<string, string | number | boolean>

function coerce(
  field: ZotzFlowInputField,
  value: string | number | boolean
): string | number | boolean {
  switch (field.type) {
    case 'number': {
      const number = typeof value === 'number' ? value : Number(String(value).trim())
      if (!Number.isFinite(number) || String(value).trim() === '') {
        throw new InvalidArgumentError(`Input "${field.name}" must be a number.`)
      }
      return number
    }
    case 'boolean': {
      if (typeof value === 'boolean') {
        return value
      }
      const text = String(value).trim().toLowerCase()
      if (['true', '1', 'yes', 'si', 'sí'].includes(text)) {
        return true
      }
      if (['false', '0', 'no'].includes(text)) {
        return false
      }
      throw new InvalidArgumentError(`Input "${field.name}" must be true or false.`)
    }
    case 'select': {
      const text = String(value)
      if (!field.options.includes(text)) {
        throw new InvalidArgumentError(
          `Input "${field.name}" must be one of: ${field.options.join(', ')}.`
        )
      }
      return text
    }
    case 'text':
      return String(value)
  }
}

/** Applies defaults, types and required fields; inputs a trigger does not declare pass as given. */
export function buildZotzFlowInputValues(
  fields: readonly ZotzFlowInputField[],
  given: RawInputs
): ZotzFlowInputValues {
  const values: ZotzFlowInputValues = { ...given }
  for (const field of fields) {
    const value = given[field.name] ?? field.default
    if (value === undefined) {
      if (field.required) {
        throw new InvalidArgumentError(`Missing input "${field.name}".`)
      }
      continue
    }
    values[field.name] = coerce(field, value)
  }
  return values
}

/** The trigger a run started from the app, the CLI or `/flow` carries (spec §4.2). */
export function buildZotzFlowRequestTrigger(
  flow: ZotzFlow,
  params: z.infer<typeof ZotzFlowsRunParams>,
  now: number
): { trigger: ZotzFlowRunTrigger; origin: ZotzFlowRunOrigin } {
  if (params.triggerId === undefined) {
    // Without a manual trigger the flow still runs by hand, with whatever inputs were given.
    const manual = flow.triggers.find((trigger) => trigger.kind === 'manual')
    return {
      trigger: {
        triggerId: manual?.id ?? null,
        kind: 'manual',
        inputs: buildZotzFlowInputValues(
          manual?.kind === 'manual' ? manual.inputs : [],
          params.inputs
        )
      },
      origin: { source: 'manual' }
    }
  }
  const trigger = flow.triggers.find((entry) => entry.id === params.triggerId)
  if (!trigger) {
    throw new InvalidArgumentError('This flow has no such trigger.')
  }
  switch (trigger.kind) {
    case 'manual':
      return {
        trigger: {
          triggerId: trigger.id,
          kind: 'manual',
          inputs: buildZotzFlowInputValues(trigger.inputs, params.inputs)
        },
        origin: { source: 'manual' }
      }
    case 'chat_command':
      return {
        trigger: {
          triggerId: trigger.id,
          kind: 'chat_command',
          inputs: buildZotzFlowInputValues(trigger.inputs, params.inputs),
          text: params.text ?? ''
        },
        origin: { source: 'chat' }
      }
    case 'schedule':
      // "Run now" on a scheduled flow behaves like that occurrence came due.
      return {
        trigger: { triggerId: trigger.id, kind: 'schedule', scheduledFor: now },
        origin: { source: 'manual' }
      }
    default:
      throw new InvalidArgumentError('This trigger fires on its own and cannot be run by hand.')
  }
}
