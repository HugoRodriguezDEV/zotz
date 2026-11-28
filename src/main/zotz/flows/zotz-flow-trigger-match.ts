import type { AgentTurnOutcome } from '../../../shared/agent-status/lifecycle/agent-turn-outcome'
import type {
  ZotzFlowAgentOutcome,
  ZotzFlowPullRequestAction,
  ZotzFlowTrigger
} from '../../../shared/zotz/flows/zotz-flow-trigger-contract'

type TriggerOf<K extends ZotzFlowTrigger['kind']> = Extract<ZotzFlowTrigger, { kind: K }>
type Candidates = readonly (string | null | undefined)[]

/** A free-text filter (as the canvas saves it) names any of the event's ids or names. */
export function zotzFlowFilterMatches(filter: string | undefined, candidates: Candidates): boolean {
  const wanted = filter?.trim().toLowerCase()
  if (!wanted) {
    return true
  }
  return candidates.some((candidate) => candidate?.trim().toLowerCase() === wanted)
}

/** Unknown verdicts count as success: hooks of older agents report no outcome at all. */
export function zotzFlowAgentOutcome(verdict: AgentTurnOutcome | null): ZotzFlowAgentOutcome {
  switch (verdict) {
    case 'failure':
    case 'interruption':
    case 'unconfirmed':
      return 'error'
    case 'cancellation':
    case 'superseded':
      return 'interrupted'
    case 'success':
    case null:
      return 'success'
  }
}

export type ZotzFlowAgentFinishedFacts = {
  agentId: string
  outcome: ZotzFlowAgentOutcome
  project: Candidates
  workspace: Candidates
}

export function zotzFlowAgentFinishedMatches(
  trigger: TriggerOf<'agent_finished'>,
  facts: ZotzFlowAgentFinishedFacts
): boolean {
  return (
    (trigger.agents.length === 0 || trigger.agents.some((agent) => agent === facts.agentId)) &&
    (trigger.outcomes.length === 0 || trigger.outcomes.includes(facts.outcome)) &&
    zotzFlowFilterMatches(trigger.projectId, facts.project) &&
    zotzFlowFilterMatches(trigger.workspaceId, facts.workspace)
  )
}

export type ZotzFlowPullRequestFacts = {
  action: ZotzFlowPullRequestAction
  repo: string
  baseBranch: string
  author: string
  labels: readonly string[]
}

export function zotzFlowPullRequestMatches(
  trigger: TriggerOf<'pull_request'>,
  facts: ZotzFlowPullRequestFacts
): boolean {
  return (
    trigger.actions.includes(facts.action) &&
    zotzFlowFilterMatches(trigger.repo, [facts.repo]) &&
    zotzFlowFilterMatches(trigger.baseBranch, [facts.baseBranch]) &&
    zotzFlowFilterMatches(trigger.author, [facts.author]) &&
    zotzFlowFilterMatches(trigger.label, facts.labels)
  )
}

export type ZotzFlowTaskMovedFacts = {
  source: Candidates
  project: Candidates
  from: Candidates
  to: Candidates
}

export function zotzFlowTaskMovedMatches(
  trigger: TriggerOf<'task_moved'>,
  facts: ZotzFlowTaskMovedFacts
): boolean {
  return (
    zotzFlowFilterMatches(trigger.source, facts.source) &&
    zotzFlowFilterMatches(trigger.project, facts.project) &&
    zotzFlowFilterMatches(trigger.fromColumn, facts.from) &&
    zotzFlowFilterMatches(trigger.toColumn, facts.to)
  )
}
