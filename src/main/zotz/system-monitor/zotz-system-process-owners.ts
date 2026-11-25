import {
  ZOTZ_SYSTEM_PROCESS_LIMIT,
  type ZotzSystemProcess,
  type ZotzSystemProcessEntry,
  type ZotzSystemProcessOwner
} from '../../../shared/zotz/system-monitor/zotz-system-monitor-contract'

/** The busiest by CPU and the largest by memory, so both detail views find their leaders. */
export function topZotzProcesses(rows: readonly ZotzSystemProcess[]): ZotzSystemProcess[] {
  const half = Math.ceil(ZOTZ_SYSTEM_PROCESS_LIMIT / 2)
  const byCpu = rows.toSorted(
    (a, b) => b.cpuPercent - a.cpuPercent || b.memoryBytes - a.memoryBytes
  )
  const byMemory = rows.toSorted((a, b) => b.memoryBytes - a.memoryBytes)
  const picked = new Map<number, ZotzSystemProcess>()
  for (const row of [...byCpu.slice(0, half), ...byMemory.slice(0, half)]) {
    picked.set(row.pid, row)
  }
  return [...picked.values()].sort(
    (a, b) => b.cpuPercent - a.cpuPercent || b.memoryBytes - a.memoryBytes
  )
}

export type ZotzAgentProcessRoot = {
  pid: number
  agent: string
  worktreeId: string | null
  paneKey: string
}

/**
 * Tags each process by walking up its parents: the first agent root claims it (an agent's own
 * tree), else a Zotz process makes it Zotz itself or something Zotz started (a terminal, a tool).
 */
export function zotzProcessOwners(
  processes: readonly ZotzSystemProcess[],
  agentRoots: readonly ZotzAgentProcessRoot[],
  zotzPids: ReadonlySet<number>
): ZotzSystemProcessEntry[] {
  const parentOf = new Map(processes.map((row) => [row.pid, row.ppid]))
  const agentByPid = new Map(agentRoots.map((root) => [root.pid, root]))
  const ownerOf = (pid: number): ZotzSystemProcessOwner | null => {
    const seen = new Set<number>()
    let current: number | undefined = pid
    while (current !== undefined && current > 0 && !seen.has(current)) {
      seen.add(current)
      const root = agentByPid.get(current)
      if (root) {
        return {
          kind: 'agent',
          agent: root.agent,
          worktreeId: root.worktreeId,
          paneKey: root.paneKey
        }
      }
      if (zotzPids.has(current)) {
        return current === pid ? { kind: 'zotz' } : { kind: 'zotz-child' }
      }
      current = parentOf.get(current)
    }
    return null
  }
  return processes.map((row) => ({ ...row, owner: ownerOf(row.pid) }))
}
