import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { CommandHandler } from '../dispatch/dispatch'
import type { RuntimeClient } from '../runtime/client'
import {
  getOptionalPositiveIntegerFlag,
  getRepeatedStringFlag,
  getRequiredStringFlag
} from '../arguments/flags'
import { printResult } from '../output/command-result-output'
import { RuntimeClientError } from '../runtime/connection/types'
import {
  ZOTZ_FLOW_SCHEMA,
  ZotzFlowExportSchema,
  type ZotzFlow,
  type ZotzFlowExport
} from '../../shared/zotz/flows/zotz-flow-contract'
import { isFinalZotzFlowRunStatus } from '../../shared/zotz/flows/zotz-flow-run-contract'
import type {
  ZotzFlowsListResult,
  ZotzFlowsRunGetResult,
  ZotzFlowsRunResult,
  ZotzFlowsRunsResult,
  ZotzFlowsSaveResult
} from '../../shared/rpc-contract/zotz/zotz-flows-params'
import {
  formatZotzFlowList,
  formatZotzFlowProblems,
  formatZotzFlowRun,
  formatZotzFlowRuns
} from './zotz-flows-format'

const WAIT_POLL_MS = 1500

async function findFlow(client: RuntimeClient, slug: string): Promise<ZotzFlow> {
  const { result } = await client.call<ZotzFlowsListResult>('zotz.flows.list', {})
  const flow = result.flows.find((entry) => entry.slug === slug || entry.id === slug)
  if (!flow) {
    throw new RuntimeClientError('invalid_argument', `No flow "${slug}". See: orca flows list`)
  }
  return flow
}

function readInputs(flags: Map<string, string | boolean>): Record<string, string> {
  const inputs: Record<string, string> = {}
  for (const entry of getRepeatedStringFlag(flags, 'input')) {
    const separator = entry.indexOf('=')
    if (separator <= 0) {
      throw new RuntimeClientError(
        'invalid_argument',
        `--input must look like name=value, got "${entry}"`
      )
    }
    inputs[entry.slice(0, separator)] = entry.slice(separator + 1)
  }
  return inputs
}

async function readText(file: string, cwd: string): Promise<string> {
  if (file !== '-') {
    return readFile(path.resolve(cwd, file), 'utf8')
  }
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
  }
  return Buffer.concat(chunks).toString('utf8')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const ZOTZ_FLOWS_HANDLERS: Record<string, CommandHandler> = {
  'flows list': async ({ client, json }) => {
    const response = await client.call<ZotzFlowsListResult>('zotz.flows.list', {})
    printResult(response, json, (result) => formatZotzFlowList(result.flows))
  },
  'flows run': async ({ flags, client, json }) => {
    const flow = await findFlow(client, getRequiredStringFlag(flags, 'slug'))
    const started = await client.call<ZotzFlowsRunResult>('zotz.flows.run', {
      id: flow.id,
      inputs: readInputs(flags)
    })
    if (flags.get('wait') !== true) {
      printResult(started, json, (result) => `Started:\n${formatZotzFlowRun(result.run, flow)}`)
      return
    }
    let response: { result: ZotzFlowsRunGetResult } = { result: { run: started.result.run } }
    while (response.result.run && !isFinalZotzFlowRunStatus(response.result.run.status)) {
      await sleep(WAIT_POLL_MS)
      response = await client.call<ZotzFlowsRunGetResult>('zotz.flows.runGet', {
        runId: started.result.run.id
      })
    }
    const finished = response.result.run ?? started.result.run
    printResult({ ...started, result: { run: finished } }, json, (result) =>
      formatZotzFlowRun(result.run, flow)
    )
    if (finished.status !== 'done') {
      process.exitCode = 1
    }
  },
  'flows runs': async ({ flags, client, json }) => {
    const flow = await findFlow(client, getRequiredStringFlag(flags, 'slug'))
    const response = await client.call<ZotzFlowsRunsResult>('zotz.flows.runs', {
      flowId: flow.id,
      limit: getOptionalPositiveIntegerFlag(flags, 'limit') ?? 5
    })
    printResult(response, json, (result) => formatZotzFlowRuns(result.runs, flow))
  },
  'flows export': async ({ flags, client }) => {
    const flow = await findFlow(client, getRequiredStringFlag(flags, 'slug'))
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = flow
    const file: ZotzFlowExport = { schema: ZOTZ_FLOW_SCHEMA, flow: draft }
    console.log(JSON.stringify(file, null, 2))
  },
  'flows import': async ({ flags, client, cwd, json }) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(await readText(getRequiredStringFlag(flags, 'file'), cwd))
    } catch (error) {
      throw new RuntimeClientError(
        'invalid_argument',
        `The file is not JSON: ${error instanceof Error ? error.message : String(error)}`
      )
    }
    const file = ZotzFlowExportSchema.safeParse(parsed)
    if (!file.success) {
      const issue = file.error.issues[0]
      throw new RuntimeClientError(
        'invalid_argument',
        `Not a ${ZOTZ_FLOW_SCHEMA} file: ${issue?.path.join('.') || '(root)'} ${issue?.message ?? ''}`
      )
    }
    const { result: listed } = await client.call<ZotzFlowsListResult>('zotz.flows.list', {})
    const existing = listed.flows.find((entry) => entry.id === file.data.flow.id)
    const response = await client.call<ZotzFlowsSaveResult>('zotz.flows.save', {
      flow: file.data.flow,
      expectedUpdatedAt: existing?.updatedAt ?? null
    })
    printResult(response, json, (result) => {
      if (result.saved) {
        const warnings =
          result.problems.length > 0 ? `\n${formatZotzFlowProblems(result.problems)}` : ''
        return `${existing ? 'Replaced' : 'Imported'} "${result.flow.name}" (${result.flow.slug}).${warnings}`
      }
      return result.reason === 'invalid'
        ? `The flow was not saved:\n${formatZotzFlowProblems(result.problems)}`
        : 'The flow changed while importing; run the import again.'
    })
    if (!response.result.saved) {
      process.exitCode = 1
    }
  }
}
