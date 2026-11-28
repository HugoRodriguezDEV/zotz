import {
  ZOTZ_FLOW_SWITCH_DEFAULT_PORT,
  type ZotzFlowConditionOperator,
  type ZotzFlowNodeOf
} from '../../../shared/zotz/flows/zotz-flow-node-contract'
import {
  ZotzFlowStepError,
  type ZotzFlowStepContext,
  type ZotzFlowStepResult
} from './zotz-flow-executor-types'
import { formatZotzFlowStepOutput } from './zotz-flow-step-output'
import { runZotzFlowAgentStep } from './zotz-flow-agent-step'
import { runZotzFlowLoopStep } from './zotz-flow-loop-step'

/** Waits `ms`, rejecting as soon as the step is aborted. */
export function sleepZotzFlowStep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    const timer = setTimeout(
      () => {
        signal.removeEventListener('abort', abort)
        resolve()
      },
      Math.max(0, ms)
    )
    const abort = (): void => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    signal.addEventListener('abort', abort, { once: true })
  })
}

function asNumber(text: string): number | null {
  const trimmed = text.trim()
  const value = Number(trimmed)
  return trimmed !== '' && Number.isFinite(value) ? value : null
}

function compareNumbers(value: string, compareTo: string): number {
  const left = asNumber(value)
  const right = asNumber(compareTo)
  if (left === null || right === null) {
    throw new ZotzFlowStepError(
      `Cannot compare "${value}" with "${compareTo}" as numbers.`,
      'not_a_number'
    )
  }
  return left - right
}

function sameValue(value: string, compareTo: string): boolean {
  const left = asNumber(value)
  const right = asNumber(compareTo)
  return left !== null && right !== null ? left === right : value.trim() === compareTo.trim()
}

export function evaluateZotzFlowCondition(
  operator: ZotzFlowConditionOperator,
  value: string,
  compareTo: string
): boolean {
  switch (operator) {
    case 'equals':
      return sameValue(value, compareTo)
    case 'not_equals':
      return !sameValue(value, compareTo)
    case 'contains':
      return value.includes(compareTo)
    case 'not_contains':
      return !value.includes(compareTo)
    case 'greater_than':
      return compareNumbers(value, compareTo) > 0
    case 'less_than':
      return compareNumbers(value, compareTo) < 0
    case 'exists':
      return value.trim() !== ''
    case 'not_exists':
      return value.trim() === ''
    case 'exit_code_zero':
      return asNumber(value) === 0
  }
}

/** Milliseconds from `from` to the next `HH:MM` wall-clock time in `timezone`. */
export function msUntilZotzFlowTime(time: string, timezone: string, from: number): number {
  const [hours, minutes] = time.split(':').map(Number)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(new Date(from))
  const part = (type: string): number => Number(parts.find((entry) => entry.type === type)?.value)
  const nowSeconds = part('hour') * 3600 + part('minute') * 60 + part('second')
  let diff = hours * 3600 + minutes * 60 - nowSeconds
  if (diff <= 0) {
    diff += 24 * 3600
  }
  return diff * 1000
}

async function runWait(ctx: ZotzFlowStepContext, node: ZotzFlowNodeOf<'wait'>): Promise<void> {
  // Measured from the attempt start, so a restart waits only for what is left.
  const startedAt = ctx.attempt.startedAt
  let waitMs: number
  try {
    waitMs =
      node.wait.mode === 'duration'
        ? node.wait.seconds * 1000
        : msUntilZotzFlowTime(node.wait.time, node.wait.timezone, startedAt)
  } catch (error) {
    throw new ZotzFlowStepError(
      `Cannot read the time zone: ${error instanceof Error ? error.message : String(error)}`,
      'invalid_timezone'
    )
  }
  await sleepZotzFlowStep(startedAt + waitMs - ctx.deps.now(), ctx.signal)
}

async function runCommand(
  ctx: ZotzFlowStepContext,
  node: ZotzFlowNodeOf<'command'>
): Promise<ZotzFlowStepResult> {
  // Template values only ever reach the shell as variables (spec §4.5).
  const env = Object.fromEntries(
    node.env.map((entry) => {
      const value = ctx.resolve(entry.value)
      ctx.nodeRun.inputs[`env.${entry.name}`] = value
      return [`ZOTZ_FLOW_${entry.name.toUpperCase()}`, value]
    })
  )
  ctx.nodeRun.inputs.command = node.command
  const result = await ctx.deps.runCommand({
    command: node.command,
    env,
    cwd: node.cwd,
    signal: ctx.signal
  })
  ctx.nodeRun.exitCode = result.exitCode
  ctx.nodeRun.stderr = result.stderr
  if (result.error !== null) {
    throw new ZotzFlowStepError(result.error, 'command_failed', {
      markdown: result.stdout,
      json: null,
      truncated: result.truncated,
      capturedAt: ctx.deps.now()
    })
  }
  // A non-zero exit is a result, not a failure: a Condition reads it (spec §4.3).
  return {
    output: formatZotzFlowStepOutput(result.stdout, node.output, result.truncated, ctx.deps.now())
  }
}

async function runHttp(
  ctx: ZotzFlowStepContext,
  node: ZotzFlowNodeOf<'http'>
): Promise<ZotzFlowStepResult> {
  const url = ctx.resolve(node.url)
  const headers = Object.fromEntries(
    node.headers.map((header) => [header.name, ctx.resolve(header.value)])
  )
  const body = node.body === undefined ? undefined : ctx.resolve(node.body)
  ctx.nodeRun.inputs = { url, ...(body === undefined ? {} : { body }) }
  const response = await ctx.deps.fetch({
    method: node.method,
    url,
    headers,
    body,
    signal: ctx.signal
  })
  ctx.nodeRun.httpStatus = response.status
  const now = ctx.deps.now()
  if (response.status < 200 || response.status >= 300) {
    throw new ZotzFlowStepError(`The server answered ${response.status}.`, 'http_status', {
      markdown: response.body,
      json: null,
      truncated: response.truncated,
      capturedAt: now
    })
  }
  return { output: formatZotzFlowStepOutput(response.body, node.output, response.truncated, now) }
}

async function runSubflow(
  ctx: ZotzFlowStepContext,
  node: ZotzFlowNodeOf<'subflow'>
): Promise<ZotzFlowStepResult> {
  const inputs = Object.fromEntries(
    Object.entries(node.inputs).map(([name, text]) => [name, ctx.resolve(text)])
  )
  ctx.nodeRun.inputs = Object.fromEntries(
    Object.entries(inputs).map(([name, value]) => [`inputs.${name}`, value])
  )
  const child = await ctx.deps.runSubflow({
    flowId: node.flowId,
    inputs,
    parent: { flowId: ctx.flow.id, runId: ctx.run.id, nodeId: node.id },
    existingRunId: ctx.resuming ? ctx.nodeRun.childRunId : undefined,
    onStarted: (runId) => {
      ctx.nodeRun.childRunId = runId
      ctx.changed()
    },
    signal: ctx.signal
  })
  if (child.run.status !== 'done') {
    throw new ZotzFlowStepError(
      `The called flow ended ${child.run.status}${child.run.error ? `: ${child.run.error}` : '.'}`,
      'subflow_failed',
      child.output
    )
  }
  return { output: child.output }
}

/** Runs one attempt of a step; throws ZotzFlowStepError (or the abort reason) on failure. */
export async function runZotzFlowStep(ctx: ZotzFlowStepContext): Promise<ZotzFlowStepResult> {
  const { node } = ctx
  const now = (): number => ctx.deps.now()
  switch (node.kind) {
    case 'agent':
      return runZotzFlowAgentStep(ctx, node)
    case 'for_each':
      return runZotzFlowLoopStep(ctx, node)
    case 'command':
      return runCommand(ctx, node)
    case 'http':
      return runHttp(ctx, node)
    case 'subflow':
      return runSubflow(ctx, node)
    case 'template': {
      const content = ctx.resolve(node.content)
      return { output: formatZotzFlowStepOutput(content, node.output, false, now()) }
    }
    case 'condition': {
      const value = ctx.resolve(node.value)
      const compareTo = ctx.resolve(node.compareTo ?? '')
      ctx.nodeRun.inputs = { value, compareTo }
      return { port: evaluateZotzFlowCondition(node.operator, value, compareTo) ? 'true' : 'false' }
    }
    case 'switch': {
      const value = ctx.resolve(node.value)
      ctx.nodeRun.inputs = { value }
      const match = node.cases.find((entry) => sameValue(value, ctx.resolve(entry.equals)))
      return { port: match?.port ?? ZOTZ_FLOW_SWITCH_DEFAULT_PORT }
    }
    case 'wait':
      await runWait(ctx, node)
      return {}
    case 'approval': {
      ctx.nodeRun.inputs = { message: ctx.resolve(node.message) }
      return { port: await ctx.waitForApproval() }
    }
    case 'notify': {
      const title = ctx.resolve(node.title)
      const body = ctx.resolve(node.body)
      ctx.nodeRun.inputs = { title, body }
      await ctx.deps.notify({ title, body, flow: ctx.flow, run: ctx.run })
      const markdown = body ? `${title}\n\n${body}` : title
      return { output: { markdown, json: null, truncated: false, capturedAt: now() } }
    }
    case 'parallel':
    case 'join':
      return {}
    case 'chat_reply':
      // The executor skips it before reaching here; replying in a chat arrives with part 4.
      throw new ZotzFlowStepError('Replying in a chat is not available yet.', 'chat_reply_pending')
  }
}
