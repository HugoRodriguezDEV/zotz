import { runProcess } from '@orca/process-host'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { ZotzSystemProcess } from '../../../shared/zotz/system-monitor/zotz-system-monitor-contract'

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

/** `ps -Ao pid=,ppid=,pcpu=,rss=,user=,comm=`, every process. */
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
  return rows
}

export async function readZotzPsProcesses(): Promise<ZotzSystemProcess[] | null> {
  const stdout = await readZotzCommand('/bin/ps', ZOTZ_PS_ARGS, 16 * 1024 * 1024)
  if (stdout === null) {
    return null
  }
  const rows = parseZotzPsProcesses(stdout)
  return rows.length > 0 ? rows : null
}
