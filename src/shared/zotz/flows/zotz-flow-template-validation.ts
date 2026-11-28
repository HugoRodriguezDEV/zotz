import type { ZotzFlowDraft } from './zotz-flow-contract'
import type { ZotzFlowNode } from './zotz-flow-node-contract'
import { zotzFlowError, zotzFlowWarning, type ZotzFlowProblem } from './zotz-flow-problems'
import { ZOTZ_FLOW_CHAT_TEMPLATE_KEYS } from './zotz-flow-run-contract'
import { getZotzFlowNodeTemplateFields, parseZotzFlowTemplate } from './zotz-flow-template-refs'
import type { ZotzFlowTrigger } from './zotz-flow-trigger-contract'

type ChatTrigger = Extract<ZotzFlowTrigger, { kind: 'chat_command' }>
type ProblemAt = Pick<ZotzFlowProblem, 'nodeId' | 'field' | 'params'>

export type ZotzFlowTemplateScope = {
  /** Nodes guaranteed to finish before the given node. */
  before: (nodeId: string) => ReadonlySet<string>
  /** Enclosing `for_each` ids, innermost first; empty outside loops. */
  loops: (nodeId: string) => string[]
}

export function checkZotzFlowTemplates(
  flow: Pick<ZotzFlowDraft, 'triggers' | 'nodes'>,
  scope: ZotzFlowTemplateScope,
  problems: ZotzFlowProblem[]
): void {
  const byName = new Map<string, ZotzFlowNode>()
  for (const node of flow.nodes) {
    if (!byName.has(node.name)) {
      byName.set(node.name, node)
    }
  }
  const chatTriggers = flow.triggers.filter(isChatTrigger)

  for (const node of flow.nodes) {
    if (node.kind === 'command' && node.command.includes('{{')) {
      problems.push(
        zotzFlowError(
          'template_in_command',
          'Pass values to a command through its variables, not its text.',
          { nodeId: node.id, field: 'command' }
        )
      )
    }
    for (const { field, text } of getZotzFlowNodeTemplateFields(node)) {
      const parsed = parseZotzFlowTemplate(text)
      for (const issue of parsed.issues) {
        problems.push(
          zotzFlowError('template_syntax', `Invalid template ${issue.raw}.`, {
            nodeId: node.id,
            field,
            params: { template: issue.raw, reason: issue.reason }
          })
        )
      }
      for (const ref of parsed.refs) {
        const at = { nodeId: node.id, field, params: { template: ref.raw } }
        if (ref.root === 'node') {
          const target = byName.get(ref.nodeName)
          if (!target) {
            problems.push(zotzFlowError('template_unknown_node', `${ref.raw} names no node.`, at))
          } else if (!scope.before(node.id).has(target.id)) {
            problems.push(
              zotzFlowError(
                'template_not_before',
                `${ref.raw} reads a node that does not run before this one.`,
                at
              )
            )
          }
        } else if (ref.root === 'item' && scope.loops(node.id).length === 0) {
          problems.push(
            zotzFlowError(
              'template_item_outside_loop',
              `${ref.raw} only works inside a "for each" loop.`,
              at
            )
          )
        } else if (ref.root === 'chat') {
          checkChatRef(ref.path[0], ref.raw, chatTriggers, at, problems)
        }
      }
    }
  }
}

function isChatTrigger(trigger: ZotzFlowTrigger): trigger is ChatTrigger {
  return trigger.kind === 'chat_command'
}

function isChatTemplateKey(
  key: string | undefined
): key is keyof typeof ZOTZ_FLOW_CHAT_TEMPLATE_KEYS {
  return key !== undefined && Object.hasOwn(ZOTZ_FLOW_CHAT_TEMPLATE_KEYS, key)
}

function checkChatRef(
  key: string | undefined,
  raw: string,
  chatTriggers: ChatTrigger[],
  at: ProblemAt,
  problems: ZotzFlowProblem[]
): void {
  if (chatTriggers.length === 0) {
    problems.push(zotzFlowError('chat_without_trigger', `${raw} needs a chat command trigger.`, at))
    return
  }
  if (!isChatTemplateKey(key)) {
    problems.push(zotzFlowError('template_unknown_chat_field', `${raw} is not a chat field.`, at))
    return
  }
  const flag = ZOTZ_FLOW_CHAT_TEMPLATE_KEYS[key]
  if (flag !== null && !chatTriggers.some((trigger) => trigger.context[flag])) {
    problems.push(
      zotzFlowWarning(
        'chat_context_not_requested',
        `${raw} is empty unless the chat command sends it.`,
        at
      )
    )
  }
}

/** Steps that only make sense when a chat command fired the flow. */
export function checkZotzFlowChatOnlyNodes(
  flow: Pick<ZotzFlowDraft, 'triggers' | 'nodes'>,
  problems: ZotzFlowProblem[]
): void {
  if (flow.triggers.some(isChatTrigger)) {
    return
  }
  for (const node of flow.nodes) {
    const needsChat =
      node.kind === 'chat_reply' ||
      (node.kind === 'agent' && (node.workspaceSource === 'chat' || node.runInChatSession))
    if (needsChat) {
      problems.push(
        zotzFlowError('chat_without_trigger', 'This step needs a chat command trigger.', {
          nodeId: node.id
        })
      )
    }
  }
}
