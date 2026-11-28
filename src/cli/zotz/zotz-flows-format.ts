import type { ZotzFlow } from '../../shared/zotz/flows/zotz-flow-contract'
import type { ZotzFlowProblem } from '../../shared/zotz/flows/zotz-flow-problems'
import type { ZotzFlowNodeRun, ZotzFlowRun } from '../../shared/zotz/flows/zotz-flow-run-contract'

const PREVIEW_CHARS = 160

function preview(text: string | null | undefined): string {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim()
  return flat.length > PREVIEW_CHARS ? `${flat.slice(0, PREVIEW_CHARS)}…` : flat
}

function seconds(from: number | null, to: number | null): string {
  return from !== null && to !== null ? ` ${Math.max(0, Math.round((to - from) / 1000))}s` : ''
}

export function formatZotzFlowList(flows: ZotzFlow[]): string {
  if (flows.length === 0) {
    return 'No flows on this machine.'
  }
  return flows
    .map(
      (flow) =>
        `${flow.slug}  ${flow.name}${flow.enabled ? '' : ' (off)'}  · ${flow.nodes.length} steps · triggers: ${
          flow.triggers.map((trigger) => trigger.kind).join(', ') || 'none'
        }`
    )
    .join('\n')
}

function nodeLine(flow: ZotzFlow | null, nodeRun: ZotzFlowNodeRun): string {
  const node = flow?.nodes.find((entry) => entry.id === nodeRun.nodeId)
  const name = node ? `${node.name} (${node.kind})` : nodeRun.nodeId
  const where =
    nodeRun.iteration.length > 0 ? `[${nodeRun.iteration.map((i) => i + 1).join('.')}] ` : ''
  const details = [
    nodeRun.port && nodeRun.port !== 'main' ? `-> ${nodeRun.port}` : '',
    nodeRun.exitCode !== undefined && nodeRun.exitCode !== null ? `exit ${nodeRun.exitCode}` : '',
    nodeRun.attempts.length > 1 ? `${nodeRun.attempts.length} attempts` : '',
    nodeRun.jsonCorrectionRequested ? 'JSON corrected once' : '',
    nodeRun.output?.json !== null && nodeRun.output?.json !== undefined
      ? `json ${preview(JSON.stringify(nodeRun.output.json))}`
      : '',
    nodeRun.loop
      ? `${nodeRun.loop.iterations.filter((it) => it.status === 'done').length}/${nodeRun.loop.total} done`
      : '',
    seconds(nodeRun.startedAt, nodeRun.finishedAt).trim(),
    nodeRun.error ? `error: ${preview(nodeRun.error)}` : ''
  ].filter(Boolean)
  const indent = '  '.repeat(nodeRun.iteration.length + 1)
  return `${indent}${where}${name}: ${nodeRun.status}${details.length > 0 ? `  ${details.join(' · ')}` : ''}`
}

/** Top-level steps in run order, each loop followed by its iterations' steps. */
function orderedNodeRuns(run: ZotzFlowRun, flow: ZotzFlow | null): ZotzFlowNodeRun[] {
  const parents = new Map(flow?.nodes.map((node) => [node.id, node.parentId]) ?? [])
  const outermost = (nodeId: string): string => {
    let current = nodeId
    for (let parent = parents.get(current); parent !== undefined; parent = parents.get(current)) {
      current = parent
    }
    return current
  }
  const key = (nodeRun: ZotzFlowNodeRun): string =>
    nodeRun.iteration.map((i) => String(i).padStart(5, '0')).join('.')
  const inner = run.nodes
    .filter((nodeRun) => nodeRun.iteration.length > 0)
    .sort((a, b) => key(a).localeCompare(key(b)) || (a.startedAt ?? 0) - (b.startedAt ?? 0))
  return run.nodes.flatMap((nodeRun) =>
    nodeRun.iteration.length === 0
      ? [nodeRun, ...inner.filter((entry) => outermost(entry.nodeId) === nodeRun.nodeId)]
      : []
  )
}

export function formatZotzFlowRun(run: ZotzFlowRun, flow: ZotzFlow | null): string {
  const header = `#${run.runNumber} ${run.status} · ${run.trigger.kind} · ${new Date(run.createdAt).toISOString()}${seconds(run.startedAt, run.finishedAt)}  (run ${run.id})`
  const lines = [header]
  if (run.error) {
    lines.push(`  error: ${run.error}`)
  }
  for (const nodeRun of orderedNodeRuns(run, flow)) {
    lines.push(nodeLine(flow, nodeRun))
  }
  return lines.join('\n')
}

export function formatZotzFlowRuns(runs: ZotzFlowRun[], flow: ZotzFlow | null): string {
  return runs.length === 0
    ? 'This flow has not run yet.'
    : runs.map((run) => formatZotzFlowRun(run, flow)).join('\n\n')
}

export function formatZotzFlowProblems(problems: ZotzFlowProblem[]): string {
  return problems
    .map(
      (problem) =>
        `  ${problem.severity}: ${problem.message}${problem.nodeId ? ` (step ${problem.nodeId})` : ''}`
    )
    .join('\n')
}
