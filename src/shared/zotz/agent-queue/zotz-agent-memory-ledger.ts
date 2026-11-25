import type { TuiAgent } from '../../agent-launch/catalog/tui-agent'
import { isTuiAgent } from '../../agent-launch/catalog/tui-agent-config'

/** Peak memory of each agent's recent runs, newest last; persisted in Zotz's userData. */
export type ZotzAgentMemoryLedger = Partial<Record<TuiAgent, number[]>>

const RUNS_KEPT = 20

export function recordZotzAgentPeak(
  ledger: ZotzAgentMemoryLedger,
  agent: TuiAgent,
  peakBytes: number
): ZotzAgentMemoryLedger {
  if (!Number.isFinite(peakBytes) || peakBytes <= 0) {
    return ledger
  }
  const runs = [...(ledger[agent] ?? []), peakBytes].slice(-RUNS_KEPT)
  return { ...ledger, [agent]: runs }
}

/**
 * Median of the recorded peaks, capped at the per-agent ceiling. Why not a high percentile: a peak
 * covers the whole terminal tree, so the odd run that starts builds or dev servers would hold
 * every later launch even with plenty of memory free.
 */
export function estimateZotzAgentMemory(
  ledger: ZotzAgentMemoryLedger,
  agent: TuiAgent,
  defaultBytes: number,
  maxBytes: number
): number {
  const runs = ledger[agent]
  if (!runs || runs.length === 0) {
    return Math.min(defaultBytes, maxBytes)
  }
  const sorted = [...runs].sort((left, right) => left - right)
  const median = sorted[Math.ceil(sorted.length / 2) - 1]!
  return Math.min(median, maxBytes)
}

export function normalizeZotzAgentMemoryLedger(value: unknown): ZotzAgentMemoryLedger {
  const ledger: ZotzAgentMemoryLedger = {}
  if (typeof value !== 'object' || value === null) {
    return ledger
  }
  for (const [agent, runs] of Object.entries(value)) {
    if (!isTuiAgent(agent) || !Array.isArray(runs)) {
      continue
    }
    const peaks = runs.filter(
      (run): run is number => typeof run === 'number' && Number.isFinite(run) && run > 0
    )
    if (peaks.length > 0) {
      ledger[agent] = peaks.slice(-RUNS_KEPT)
    }
  }
  return ledger
}
