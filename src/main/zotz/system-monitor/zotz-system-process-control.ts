import { runProcess } from '@orca/process-host'
import { windowsSystem32Binary } from '@orca/process-host/windows-system-binary'
import path from 'node:path'
import type {
  ZotzSystemProcessCloseRequest,
  ZotzSystemProcessCloseResult
} from '../../../shared/zotz/system-monitor/zotz-system-monitor-contract'
import {
  readWindowsProcessIdentityTableFresh,
  readWindowsProcessTableFresh
} from '../../windows/windows-process-table'
import { readZotzCommand } from './zotz-system-unix-commands'

const EXIT_WAIT_MS = 3_000
const EXIT_POLL_MS = 150
// init/launchd and Windows' Idle and System: closing them takes the machine down.
const PROTECTED_PIDS = new Set([0, 1, 4])

/** "node.exe" and the perf counter's "node" are the same program. */
function sameProgram(a: string, b: string): boolean {
  const normalize = (name: string): string =>
    path
      .basename(name.trim())
      .replace(/\.exe$/i, '')
      .toLowerCase()
  return normalize(a) === normalize(b)
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM: it exists, owned by someone else.
    return errorCode(error) === 'EPERM'
  }
}

async function waitForExit(pid: number, deadlineMs = EXIT_WAIT_MS): Promise<boolean> {
  const until = Date.now() + deadlineMs
  while (Date.now() < until) {
    if (!isAlive(pid)) {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, EXIT_POLL_MS))
  }
  return !isAlive(pid)
}

/** The program now running under this PID, or null when none is. */
async function currentProgram(pid: number): Promise<string | null> {
  if (process.platform === 'win32') {
    const rows = await readWindowsProcessIdentityTableFresh().catch(() => [])
    return rows.find((row) => row.pid === pid)?.name ?? null
  }
  const out = await readZotzCommand('/bin/ps', ['-p', String(pid), '-o', 'comm='])
  return out?.trim() || null
}

/** The full command line, for the process detail; null when the OS will not say. */
export async function readZotzProcessCommandLine(pid: number): Promise<string | null> {
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    return null
  }
  if (process.platform === 'win32') {
    const rows = await readWindowsProcessTableFresh().catch(() => [])
    return rows.find((row) => row.pid === pid)?.command || null
  }
  const out = await readZotzCommand('/bin/ps', ['-p', String(pid), '-o', 'args='])
  return out?.trim() || null
}

async function signalWindows(pid: number, force: boolean): Promise<void> {
  // Without /F taskkill asks the program to close (WM_CLOSE), the nearest thing to SIGTERM.
  await runProcess({
    program: windowsSystem32Binary('taskkill.exe'),
    args: ['/PID', String(pid), ...(force ? ['/F'] : [])],
    timeoutMs: 5_000,
    maxOutputBytes: 64 * 1024
  }).catch(() => null)
}

/**
 * Closes one process the user picked: refuses machine-critical PIDs and a PID that now runs
 * another program, then waits a moment so the view can offer to force it.
 */
export async function closeZotzProcess(
  request: ZotzSystemProcessCloseRequest
): Promise<ZotzSystemProcessCloseResult> {
  const { pid, force } = request
  if (!Number.isSafeInteger(pid) || PROTECTED_PIDS.has(pid) || pid < 0) {
    return { ok: false, reason: 'protected' }
  }
  const program = await currentProgram(pid)
  if (program === null) {
    return { ok: false, reason: 'gone' }
  }
  if (!sameProgram(program, request.name)) {
    return { ok: false, reason: 'changed' }
  }
  if (process.platform === 'win32') {
    await signalWindows(pid, force)
  } else {
    try {
      process.kill(pid, force ? 'SIGKILL' : 'SIGTERM')
    } catch (error) {
      const code = errorCode(error)
      if (code === 'ESRCH') {
        return { ok: false, reason: 'gone' }
      }
      return { ok: false, reason: code === 'EPERM' ? 'not_permitted' : 'failed' }
    }
  }
  const exited = await waitForExit(pid)
  if (!exited && force) {
    // Even a forced close left it running: the OS did not let us.
    return { ok: false, reason: 'not_permitted' }
  }
  return { ok: true, exited }
}
