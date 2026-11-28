import type { ZotzFlowNodeOf } from '../../../shared/zotz/flows/zotz-flow-node-contract'
import type { ZotzFlowLoopIteration } from '../../../shared/zotz/flows/zotz-flow-run-contract'
import {
  ZotzFlowStepError,
  type ZotzFlowStepContext,
  type ZotzFlowStepResult
} from './zotz-flow-executor-types'
import { stringifyZotzFlowValue } from './zotz-flow-template-resolution'

/** A JSON array, or Markdown with one item per non-empty line (spec §4.3.1). */
export function readZotzFlowLoopItems(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value
  }
  if (typeof value !== 'string') {
    if (value === undefined || value === null) {
      return []
    }
    throw new ZotzFlowStepError('The loop list is not an array or text.', 'invalid_loop_list')
  }
  const trimmed = value.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed
      }
    } catch {
      // Not JSON: read it as lines.
    }
  }
  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function iterationMarkdown(iteration: ZotzFlowLoopIteration, total: number): string {
  const body =
    iteration.status === 'done'
      ? (iteration.output?.markdown ?? stringifyZotzFlowValue(iteration.output?.json))
      : `Failed: ${iteration.error ?? iteration.status}`
  return `### ${iteration.index + 1}/${total}\n\n${body}`
}

/** Runs the loop body once per item: in parallel by default, the memory queue paces agents. */
export async function runZotzFlowLoopStep(
  ctx: ZotzFlowStepContext,
  node: ZotzFlowNodeOf<'for_each'>
): Promise<ZotzFlowStepResult> {
  const items = readZotzFlowLoopItems(ctx.resolveValue(node.items))
  ctx.nodeRun.inputs = { items: stringifyZotzFlowValue(items) }
  // Over the cap nothing starts: a malformed list must not launch hundreds of agents.
  if (items.length > node.maxItems) {
    throw new ZotzFlowStepError(
      `The list has ${items.length} items; this loop allows ${node.maxItems}.`,
      'loop_too_many_items'
    )
  }
  const total = items.length
  const iterations: ZotzFlowLoopIteration[] = items.map((_, index) => ({
    index,
    status: 'pending',
    output: null,
    error: null
  }))
  ctx.nodeRun.loop = { total, iterations }
  ctx.changed()

  const runIteration = async (index: number): Promise<void> => {
    const iteration = iterations[index]
    iteration.status = 'running'
    ctx.changed()
    const result = await ctx.runLevel(node.id, [...ctx.path, index], {
      value: items[index],
      index,
      total
    })
    iteration.status = ctx.signal.aborted ? 'cancelled' : result.failed ? 'failed' : 'done'
    iteration.output = result.exit?.status === 'done' ? (result.exit.output ?? null) : null
    iteration.error = result.error
    ctx.changed()
  }

  if (node.order === 'sequential') {
    for (let index = 0; index < total && !ctx.signal.aborted; index++) {
      await runIteration(index)
    }
  } else {
    await Promise.all(iterations.map((_, index) => runIteration(index)))
  }
  if (ctx.signal.aborted) {
    throw ctx.signal.reason
  }
  const failed = iterations.filter((iteration) => iteration.status !== 'done')
  return {
    port: failed.length === 0 ? 'complete' : 'with_failures',
    output: {
      markdown: iterations.map((iteration) => iterationMarkdown(iteration, total)).join('\n\n'),
      json: iterations.map((iteration) =>
        iteration.status === 'done'
          ? (iteration.output?.json ?? iteration.output?.markdown ?? null)
          : null
      ),
      truncated: iterations.some((iteration) => iteration.output?.truncated),
      capturedAt: ctx.deps.now()
    }
  }
}
