import {
  isFinalZotzFlowRunStatus,
  ZOTZ_FLOW_RUNS_RETAINED_PER_FLOW,
  type ZotzFlowRun
} from './zotz-flow-run-contract'

/** Keeps the newest final runs of each flow, like automation run retention; unfinished runs always stay. */
export function pruneZotzFlowRuns(
  runs: readonly ZotzFlowRun[],
  maxPerFlow: number = ZOTZ_FLOW_RUNS_RETAINED_PER_FLOW
): ZotzFlowRun[] {
  const kept = new Set<string>()
  const finalRuns = runs.filter((run) => isFinalZotzFlowRunStatus(run.status))
  for (const flowRuns of Map.groupBy(finalRuns, (run) => run.flowId).values()) {
    flowRuns.sort((a, b) => b.createdAt - a.createdAt || b.runNumber - a.runNumber)
    for (const run of flowRuns.slice(0, Math.max(0, maxPerFlow))) {
      kept.add(run.id)
    }
  }
  return runs.filter((run) => kept.has(run.id) || !isFinalZotzFlowRunStatus(run.status))
}

export function nextZotzFlowRunNumber(runsOfFlow: readonly ZotzFlowRun[]): number {
  return runsOfFlow.reduce((highest, run) => Math.max(highest, run.runNumber), 0) + 1
}
