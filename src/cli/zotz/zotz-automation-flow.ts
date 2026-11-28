import type { Automation } from '../../shared/automations/automation-definition'
import type { RuntimeRpcSuccess } from '../../shared/remote-runtime/rpc/runtime-rpc-envelope'
import type { ZotzFlowsMigrateAutomationResult } from '../../shared/rpc-contract/zotz/zotz-flows-params'
import { formatAutomationShow } from '../automations/automation-format'
import { printResult } from '../output/command-result-output'
import type { RuntimeClient } from '../runtime/client'

type Created = RuntimeRpcSuccess<{ automation: Automation }>

async function migrate(
  writer: Pick<RuntimeClient, 'call'>,
  automationId: string
): Promise<ZotzFlowsMigrateAutomationResult> {
  try {
    return (
      await writer.call<ZotzFlowsMigrateAutomationResult>('zotz.flows.migrateAutomation', {
        automationId
      })
    ).result
  } catch (error) {
    // A machine without Flows (an older Zotz or Orca) keeps the automation as created.
    return {
      status: 'skipped',
      reason: 'invalid',
      message: error instanceof Error ? error.message : String(error)
    }
  }
}

/** `zotz automations create` makes a one-step flow (spec §8); the automation stays, turned off. */
export async function printAutomationCreatedAsFlow(
  writer: Pick<RuntimeClient, 'call'>,
  created: Created,
  json: boolean
): Promise<void> {
  const migrated = await migrate(writer, created.result.automation.id)
  printResult({ ...created, result: { ...created.result, flow: migrated } }, json, (result) => {
    const flow = result.flow
    if (flow.status === 'skipped') {
      return `${formatAutomationShow(result)}\n\nIt stays an automation and did not become a flow: ${flow.message}`
    }
    if (!flow.flow) {
      return formatAutomationShow(result)
    }
    const steps = flow.flow.nodes.map((node) => node.name).join(' → ')
    return [
      `Created flow "${flow.flow.name}" (${flow.flow.slug}): schedule → ${steps}.`,
      'It runs as a flow; the automation it came from stays off.',
      `Open it in Flows, or run it now: zotz flows run ${flow.flow.slug}`
    ].join('\n')
  })
}
