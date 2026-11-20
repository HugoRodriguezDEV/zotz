import { join } from 'node:path'
import { isJsonRecord } from './zotz-json-record'
import { SerialJsonWriter, readJsonFile } from './zotz-json-file'
import {
  normalizeZotzShortName,
  type ZotzShortNameSetResult
} from '../../shared/zotz/zotz-short-name'
import { getCanonicalUserDataPath } from '../persistence/loading-store/user-data-path'

const SHORT_NAMES_FILE = 'zotz-short-names.json'

function readNames(stored: unknown): Record<string, string> {
  const names = isJsonRecord(stored) && isJsonRecord(stored.names) ? stored.names : {}
  const result: Record<string, string> = {}
  for (const [path, value] of Object.entries(names)) {
    const name = typeof value === 'string' ? normalizeZotzShortName(value) : ''
    if (name) {
      result[path] = name
    }
  }
  return result
}

/** Custom short names of this host's workspaces, keyed by path (the same on every client). */
export class ZotzShortNameStore {
  private readonly writer = new SerialJsonWriter()
  private names: Promise<Record<string, string>> | null = null

  constructor(private readonly filePath: string) {}

  list(): Promise<Record<string, string>> {
    this.names ??= readJsonFile(this.filePath).then(readNames)
    return this.names
  }

  async set(path: string, raw: string): Promise<ZotzShortNameSetResult> {
    const current = await this.list()
    const name = normalizeZotzShortName(raw)
    if (raw.trim() && !name) {
      return { ok: false, reason: 'invalid', names: current }
    }
    if (
      name &&
      Object.entries(current).some(([other, taken]) => other !== path && taken === name)
    ) {
      return { ok: false, reason: 'taken', names: current }
    }
    const next = { ...current }
    if (name) {
      next[path] = name
    } else {
      delete next[path]
    }
    this.names = Promise.resolve(next)
    await this.writer.write(this.filePath, { version: 1, names: next })
    return { ok: true, names: next }
  }
}

let store: ZotzShortNameStore | null = null

export function getZotzShortNameStore(): ZotzShortNameStore {
  store ??= new ZotzShortNameStore(join(getCanonicalUserDataPath(), SHORT_NAMES_FILE))
  return store
}
