import { runProcess } from '@orca/process-host'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  ZOTZ_SYSTEM_PROCESS_LIMIT,
  type ZotzSystemProcess
} from '../../../shared/zotz/system-monitor/zotz-system-monitor-contract'

const COMMAND_TIMEOUT_MS = 1_500

/** A short read-only command's stdout, or null when it fails, times out or overflows. */
export async function readZotzCommand(
  program: string,
  args: readonly string[],
  maxOutputBytes = 1024 * 1024
): Promise<string | null> {
  try {
    const result = await runProcess({
      program,
      args,
      env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
      maxOutputBytes,
      timeoutMs: COMMAND_TIMEOUT_MS
    })
    return result.code === 0 && !result.timedOut && !result.outputTruncated ? result.stdout : null
  } catch {
    return null
  }
}

export function readZotzTextFile(file: string): Promise<string | null> {
  return readFile(file, 'utf8').catch(() => null)
}

// comm goes last: on macOS it is a path that may hold spaces.
export const ZOTZ_PS_ARGS = ['-Ao', 'pid=,ppid=,pcpu=,rss=,user=,comm='] as const

/** `ps -Ao pid=,ppid=,pcpu=,rss=,user=,comm=`, busiest first. */
export function parseZotzPsProcesses(stdout: string): ZotzSystemProcess[] {
  const rows: ZotzSystemProcess[] = []
  for (const line of stdout.split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+([\d.]+)\s+(\d+)\s+(\S+)\s+(.+?)\s*$/.exec(line)
    if (!match) {
      continue
    }
    const command = match[6]
    rows.push({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      cpuPercent: Number(match[3]) || 0,
      memoryBytes: Number(match[4]) * 1024,
      user: match[5],
      command,
      name: path.posix.basename(command) || command
    })
  }
  return topZotzProcesses(rows)
}

/** The busiest by CPU and the largest by memory, so both detail views find their leaders. */
export function topZotzProcesses(rows: ZotzSystemProcess[]): ZotzSystemProcess[] {
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

export async function readZotzPsProcesses(): Promise<ZotzSystemProcess[] | null> {
  const stdout = await readZotzCommand('/bin/ps', ZOTZ_PS_ARGS, 16 * 1024 * 1024)
  if (stdout === null) {
    return null
  }
  const rows = parseZotzPsProcesses(stdout)
  return rows.length > 0 ? rows : null
}
