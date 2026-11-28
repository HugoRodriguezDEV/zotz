import { homedir } from 'node:os'
import { runProcess } from '@orca/process-host'
import { windowsPowerShellPath } from '@orca/process-host/windows-system-binary'
import type { ZotzFlowCommandRequest, ZotzFlowCommandResult } from './zotz-flow-executor-types'

const MAX_COMMAND_OUTPUT_BYTES = 1024 * 1024

/** PowerShell on Windows, the user's shell on macOS and Linux (spec §7). */
export function zotzFlowCommandShell(
  command: string,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env
): { program: string; args: string[] } {
  if (platform === 'win32') {
    return {
      program: windowsPowerShellPath(env),
      args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command]
    }
  }
  return { program: env.SHELL || '/bin/sh', args: ['-c', command] }
}

/** Runs a Command step on this machine; the node timeout aborts it through the signal. */
export async function runZotzFlowCommand(
  request: ZotzFlowCommandRequest
): Promise<ZotzFlowCommandResult> {
  const { program, args } = zotzFlowCommandShell(request.command)
  try {
    const result = await runProcess(
      {
        program,
        args,
        cwd: request.cwd || homedir(),
        env: { ...process.env, ...request.env },
        timeoutMs: null,
        signal: request.signal,
        // Its own process group, so a timeout stops everything the command started.
        detached: process.platform !== 'win32',
        terminationBarrier: true,
        maxOutputBytes: MAX_COMMAND_OUTPUT_BYTES
      },
      'tail'
    )
    if (request.signal.aborted) {
      throw request.signal.reason
    }
    return {
      exitCode: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
      truncated: result.outputTruncated === true,
      error:
        result.code === null
          ? `The command stopped${result.signal ? ` (${result.signal})` : ''}.`
          : null
    }
  } catch (error) {
    if (request.signal.aborted) {
      throw request.signal.reason
    }
    return {
      exitCode: null,
      stdout: '',
      stderr: '',
      truncated: false,
      error: `The command could not start: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}
