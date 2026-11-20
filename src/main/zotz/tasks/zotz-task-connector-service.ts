import { join } from 'node:path'
import { readJsonFile, SerialJsonWriter } from '../zotz-json-file'
import { getSecretStore, hasSecretStore } from '../../../shared/secure-storage/secret-store'
import {
  parseZotzTasks,
  ZOTZ_TASKS_MAX_BYTES,
  type ZotzTasksFormat
} from '../../../shared/zotz/tasks/zotz-tasks-contract'
import type {
  ZotzTaskConnectorImportResult,
  ZotzTaskConnectorSnapshot
} from '../../../shared/zotz/tasks/zotz-task-connector-types'

const CACHE_FILE = 'zotz-task-connectors.json'
const SECRETS_FILE = 'zotz-task-connector-secrets.json'
const FETCH_TIMEOUT_MS = 15_000

async function readJsonRecord(path: string): Promise<Record<string, unknown>> {
  const value = await readJsonFile(path)
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {}
}

function isSnapshot(value: unknown): value is ZotzTaskConnectorSnapshot {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'error' in value &&
    'document' in value
  )
}

function formatFromResponse(url: string, contentType: string | null): ZotzTasksFormat | 'auto' {
  const type = contentType?.toLowerCase() ?? ''
  if (type.includes('json')) {
    return 'json'
  }
  if (type.includes('yaml')) {
    return 'yaml'
  }
  if (type.includes('toml')) {
    return 'toml'
  }
  return formatFromName(new URL(url).pathname)
}

export function formatFromName(name: string): ZotzTasksFormat | 'auto' {
  const lower = name.toLowerCase()
  if (lower.endsWith('.json')) {
    return 'json'
  }
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
    return 'yaml'
  }
  return lower.endsWith('.toml') ? 'toml' : 'auto'
}

async function fetchFeedText(
  url: string,
  token: string | null
): Promise<
  { ok: true; text: string; format: ZotzTasksFormat | 'auto' } | { ok: false; error: string }
> {
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, error: 'The feed URL must start with http:// or https://' }
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    // Fetch drops Authorization on a cross-origin redirect, so a token never leaks to another host.
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json, application/yaml, application/toml;q=0.9, text/plain;q=0.8',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      signal: controller.signal
    })
    if (!response.ok) {
      return { ok: false, error: `The service answered HTTP ${response.status}` }
    }
    if (Number(response.headers.get('content-length') ?? 0) > ZOTZ_TASKS_MAX_BYTES) {
      return { ok: false, error: 'The feed is larger than 2 MB' }
    }
    return {
      ok: true,
      text: await response.text(),
      format: formatFromResponse(url, response.headers.get('content-type'))
    }
  } catch (error) {
    return {
      ok: false,
      error: controller.signal.aborted
        ? 'The service did not answer within 15 seconds'
        : `Could not reach the service: ${error instanceof Error ? error.message : String(error)}`
    }
  } finally {
    clearTimeout(timeout)
  }
}

/** Reads external task feeds and keeps the last good document of each on disk. */
export class ZotzTaskConnectorService {
  private readonly cachePath: string
  private readonly secretsPath: string
  private readonly cache: Promise<Record<string, ZotzTaskConnectorSnapshot>>
  private readonly writer = new SerialJsonWriter()

  constructor(userDataPath: string) {
    this.cachePath = join(userDataPath, CACHE_FILE)
    this.secretsPath = join(userDataPath, SECRETS_FILE)
    this.cache = readJsonRecord(this.cachePath).then((stored) =>
      Object.fromEntries(
        Object.entries(stored).filter((entry): entry is [string, ZotzTaskConnectorSnapshot] =>
          isSnapshot(entry[1])
        )
      )
    )
  }

  async snapshot(): Promise<ZotzTaskConnectorSnapshot[]> {
    return Object.values(await this.cache)
  }

  async refresh(
    connectors: readonly { id: string; url: string }[]
  ): Promise<ZotzTaskConnectorSnapshot[]> {
    const cache = await this.cache
    await Promise.all(
      connectors.map(async ({ id, url }) => {
        const previous = cache[id]
        const feed = await fetchFeedText(url, await this.readToken(id))
        const parsed = feed.ok ? parseZotzTasks(feed.text, feed.format) : null
        cache[id] =
          parsed?.ok === true
            ? {
                id,
                fetchedAt: Date.now(),
                document: parsed.document,
                rejected: parsed.rejected,
                error: null
              }
            : {
                // Keep showing the last good tasks while the service is down or sends a bad feed.
                id,
                fetchedAt: previous?.fetchedAt ?? null,
                document: previous?.document ?? null,
                rejected: previous?.rejected ?? [],
                error: feed.ok ? (parsed?.ok === false ? parsed.error : null) : feed.error
              }
      })
    )
    await this.write(this.cachePath, cache)
    return Object.values(cache)
  }

  async importDocument(
    text: string,
    format: ZotzTasksFormat | 'auto'
  ): Promise<ZotzTaskConnectorImportResult> {
    const parsed = parseZotzTasks(text, format)
    if (!parsed.ok) {
      return { ok: false, error: parsed.error }
    }
    const id = `file-${parsed.document.source.id}`
    const snapshot: ZotzTaskConnectorSnapshot = {
      id,
      fetchedAt: Date.now(),
      document: parsed.document,
      rejected: parsed.rejected,
      error: null
    }
    const cache = await this.cache
    cache[id] = snapshot
    await this.write(this.cachePath, cache)
    return {
      ok: true,
      connector: { id, kind: 'file', name: parsed.document.source.name },
      snapshot
    }
  }

  async remove(id: string): Promise<void> {
    const cache = await this.cache
    delete cache[id]
    await this.write(this.cachePath, cache)
    await this.setToken(id, null)
  }

  /** Returns false when the OS can't encrypt; the token is then never written in plain text. */
  async setToken(id: string, token: string | null): Promise<boolean> {
    const secrets = await readJsonRecord(this.secretsPath)
    if (token) {
      if (!hasSecretStore() || !getSecretStore().isEncryptionAvailable()) {
        return false
      }
      secrets[id] = getSecretStore().encryptString(token).toString('base64')
    } else {
      delete secrets[id]
    }
    await this.write(this.secretsPath, secrets, 0o600)
    return true
  }

  private async readToken(id: string): Promise<string | null> {
    const sealed = (await readJsonRecord(this.secretsPath))[id]
    if (typeof sealed !== 'string' || !hasSecretStore()) {
      return null
    }
    try {
      return getSecretStore().decryptString(Buffer.from(sealed, 'base64'))
    } catch {
      return null
    }
  }

  private write(path: string, value: unknown, mode?: number): Promise<void> {
    return this.writer.write(path, value, { mode })
  }
}
