export type ZotzFlowProblemCode =
  | 'duplicate_node_id'
  | 'duplicate_node_name'
  | 'reserved_node_name'
  | 'parent_not_for_each'
  | 'parent_cycle'
  | 'edge_unknown_node'
  | 'edge_unknown_port'
  | 'edge_crosses_loop'
  | 'duplicate_edge'
  | 'cycle'
  | 'disconnected_node'
  | 'duplicate_switch_case'
  | 'for_each_empty'
  | 'for_each_multiple_exits'
  | 'template_syntax'
  | 'template_unknown_node'
  | 'template_not_before'
  | 'template_item_outside_loop'
  | 'template_unknown_chat_field'
  | 'template_in_command'
  | 'chat_without_trigger'
  | 'chat_context_not_requested'

/** Errors block saving; warnings are shown but allowed. */
export type ZotzFlowProblem = {
  code: ZotzFlowProblemCode
  severity: 'error' | 'warning'
  /** English fallback; the canvas localizes by `code` and `params`. */
  message: string
  nodeId?: string
  edgeId?: string
  /** Template field, as named by `getZotzFlowNodeTemplateFields`. */
  field?: string
  params?: Record<string, string>
}

export function hasZotzFlowErrors(problems: ZotzFlowProblem[]): boolean {
  return problems.some((problem) => problem.severity === 'error')
}

type ProblemTarget = Omit<ZotzFlowProblem, 'code' | 'severity' | 'message'>

export function zotzFlowError(
  code: ZotzFlowProblemCode,
  message: string,
  target: ProblemTarget
): ZotzFlowProblem {
  return { code, severity: 'error', message, ...target }
}

export function zotzFlowWarning(
  code: ZotzFlowProblemCode,
  message: string,
  target: ProblemTarget
): ZotzFlowProblem {
  return { code, severity: 'warning', message, ...target }
}
