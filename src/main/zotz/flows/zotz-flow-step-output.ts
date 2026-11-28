import type { ZotzFlow } from '../../../shared/zotz/flows/zotz-flow-contract'
import type { ZotzFlowOutputFormat } from '../../../shared/zotz/flows/zotz-flow-node-contract'
import type {
  ZotzFlowNodeOutput,
  ZotzFlowRun
} from '../../../shared/zotz/flows/zotz-flow-run-contract'
import { ZotzFlowStepError } from './zotz-flow-executor-types'
import { parseZotzFlowJsonText } from './zotz-flow-json-output'

/** Command stdout, HTTP bodies and templates: in JSON mode the whole text is the JSON (spec §4.4). */
export function formatZotzFlowStepOutput(
  text: string,
  format: ZotzFlowOutputFormat,
  truncated: boolean,
  now: number
): ZotzFlowNodeOutput {
  const output: ZotzFlowNodeOutput = { markdown: text, json: null, truncated, capturedAt: now }
  if (format.mode === 'markdown') {
    return output
  }
  const checked = parseZotzFlowJsonText(text.trim(), format)
  if (!checked.ok) {
    throw new ZotzFlowStepError(checked.error, 'invalid_json', output)
  }
  return { ...output, json: checked.value }
}

/**
 * What a run hands back to a subflow node: the output of its last top-level steps. One finished
 * step gives its output as is; several give their Markdown under each name and a JSON object keyed
 * by name (their JSON, or their Markdown when they have none).
 */
export function summarizeZotzFlowRunOutput(
  flow: Pick<ZotzFlow, 'nodes' | 'edges'>,
  run: Pick<ZotzFlowRun, 'nodes'>,
  now: number
): ZotzFlowNodeOutput | null {
  const withOutgoing = new Set(flow.edges.map((edge) => edge.from.nodeId))
  const exits = flow.nodes
    .filter((node) => node.parentId === undefined && !withOutgoing.has(node.id))
    .flatMap((node) => {
      const nodeRun = run.nodes.find(
        (entry) => entry.nodeId === node.id && entry.iteration.length === 0
      )
      return nodeRun?.status === 'done' && nodeRun.output ? [{ node, output: nodeRun.output }] : []
    })
  if (exits.length === 0) {
    return null
  }
  if (exits.length === 1) {
    return exits[0].output
  }
  return {
    markdown: exits
      .map(({ node, output }) => `## ${node.name}\n\n${output.markdown ?? ''}`)
      .join('\n\n'),
    json: Object.fromEntries(
      exits.map(({ node, output }) => [node.name, output.json ?? output.markdown])
    ),
    truncated: exits.some(({ output }) => output.truncated),
    capturedAt: now
  }
}
