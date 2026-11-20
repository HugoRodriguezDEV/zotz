import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { CommandHandler } from '../dispatch/dispatch'
import { getRequiredStringFlag, getOptionalStringFlag } from '../arguments/flags'
import { printResult } from '../output/command-result-output'
import { RuntimeClientError } from '../runtime/connection/types'
import {
  parseZotzTasks,
  zotzTasksFormatFromName,
  zotzTasksJsonSchema,
  type ZotzTasksFormat,
  type ZotzTasksParseResult
} from '../../shared/zotz/tasks/zotz-tasks-contract'
import type { ZotzTaskConnectorImportResult } from '../../shared/zotz/tasks/zotz-task-connector-types'

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function readDocument(
  flags: Map<string, string | boolean>,
  cwd: string
): Promise<{ text: string; format: ZotzTasksFormat | 'auto' }> {
  const file = getRequiredStringFlag(flags, 'file')
  const requested = getOptionalStringFlag(flags, 'format')
  if (requested && !['json', 'yaml', 'toml'].includes(requested)) {
    throw new RuntimeClientError('invalid_argument', '--format must be json, yaml or toml')
  }
  const format =
    requested === 'json' || requested === 'yaml' || requested === 'toml'
      ? requested
      : file === '-'
        ? 'auto'
        : zotzTasksFormatFromName(file)
  const text = file === '-' ? await readStdin() : await readFile(path.resolve(cwd, file), 'utf8')
  return { text, format }
}

function describeParse(result: ZotzTasksParseResult): string {
  if (!result.ok) {
    return `Invalid document: ${result.error}`
  }
  const lines = [
    `Valid zotz-tasks/v1 document from "${result.document.source.name}": ${result.document.tasks.length} tasks.`
  ]
  for (const rejected of result.rejected) {
    lines.push(`  skipped ${rejected.id ?? `#${rejected.index}`}: ${rejected.reason}`)
  }
  return lines.join('\n')
}

export const ZOTZ_TASKS_HANDLERS: Record<string, CommandHandler> = {
  'tasks validate': async ({ flags, cwd, json }) => {
    const { text, format } = await readDocument(flags, cwd)
    const result = parseZotzTasks(text, format)
    console.log(
      json
        ? JSON.stringify(
            result.ok
              ? { ok: true, tasks: result.document.tasks.length, rejected: result.rejected }
              : result,
            null,
            2
          )
        : describeParse(result)
    )
    if (!result.ok) {
      process.exitCode = 1
    }
  },
  'tasks push': async ({ flags, cwd, json, client }) => {
    const { text, format } = await readDocument(flags, cwd)
    // Fail fast with the same message the board would show, before reaching Zotz.
    const local = parseZotzTasks(text, format)
    if (!local.ok) {
      throw new RuntimeClientError('invalid_argument', `Invalid document: ${local.error}`)
    }
    const response = await client.call<ZotzTaskConnectorImportResult>('zotz.tasks.push', {
      text,
      format
    })
    printResult(response, json, (result) =>
      result.ok
        ? `Sent "${result.connector.name}" to the task board: ${result.snapshot.document?.tasks.length ?? 0} tasks, ${result.snapshot.rejected.length} skipped.`
        : `Zotz refused the document: ${result.error}`
    )
    if (!response.result.ok) {
      process.exitCode = 1
    }
  },
  'tasks schema': async () => {
    console.log(JSON.stringify(zotzTasksJsonSchema(), null, 2))
  }
}
