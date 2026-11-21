import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { renameFileWithWindowsRetryAsync } from '../../shared/file-write/windows-retry-file-operations'

export async function readJsonFile(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    // Missing or corrupt state starts empty; a corrupt file is replaced on the next save.
    return undefined
  }
}

/** `mode` restricts a file that holds secrets, e.g. 0o600. */
export async function writeJsonFileAtomically(
  path: string,
  value: unknown,
  options?: { mode?: number }
): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      mode: options?.mode
    })
    await renameFileWithWindowsRetryAsync(temporary, path)
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined)
  }
}

/** Saves run one at a time so a slow write never lands after a newer one. */
export class SerialJsonWriter {
  private pending: Promise<void> = Promise.resolve()

  write(path: string, value: unknown, options?: { mode?: number }): Promise<void> {
    const write = this.pending.then(() => writeJsonFileAtomically(path, value, options))
    this.pending = write.catch(() => undefined)
    return write
  }
}
