import { join } from 'node:path'
import { SerialJsonWriter } from '../zotz-json-file'
import { getSecretStore, hasSecretStore } from '../../../shared/secure-storage/secret-store'
import {
  parseZotzTasks,
  type ZotzTasksFormat
} from '../../../shared/zotz/tasks/zotz-tasks-contract'
import type {
  ZotzTaskConnectorImportResult,
  ZotzTaskConnectorSnapshot
} from '../../../shared/zotz/tasks/zotz-task-connector-types'
import { matchZotzTaskPullRequests } from '../../../shared/zotz/tasks/zotz-task-pr-matching'
import { fetchZotzFeedText } from './zotz-task-feed'
import { postZotzTaskAction } from './zotz-task-actions'
import { fetchZotzPullRequests, fetchZotzRecentPullRequests } from './zotz-task-development'
import {
  normalizeStoredZotzConnector,
  publicZotzConnectorSnapshot,
  readJsonRecord,
  type StoredZotzConnector
} from './zotz-task-connector-record'
import {
  applyZotzManualLinks,
  checkZotzConnectorActions,
  sendZotzConnectorLinks
} from './zotz-task-connector-sync'

const CACHE_FILE = 'zotz-task-connectors.json'
const SECRETS_FILE = 'zotz-task-connector-secrets.json'

/** Reads external task feeds, checks their actions and keeps the last good document on disk. */
export class ZotzTaskConnectorService {
  private readonly cachePath: string
  private readonly secretsPath: string
  private readonly cache: Promise<Record<string, StoredZotzConnector>>
  private readonly writer = new SerialJsonWriter()

  constructor(userDataPath: string) {
    this.cachePath = join(userDataPath, CACHE_FILE)
    this.secretsPath = join(userDataPath, SECRETS_FILE)
    this.cache = readJsonRecord(this.cachePath).then((stored) =>
      Object.fromEntries(
        Object.values(stored).flatMap((value) => {
          const entry = normalizeStoredZotzConnector(value)
          return entry ? [[entry.id, entry]] : []
        })
      )
    )
  }

  async snapshot(): Promise<ZotzTaskConnectorSnapshot[]> {
    return Object.values(await this.cache).map(publicZotzConnectorSnapshot)
  }

  async refresh(
    connectors: readonly { id: string; url: string }[]
  ): Promise<ZotzTaskConnectorSnapshot[]> {
    const cache = await this.cache
    await Promise.all(
      connectors.map(async ({ id, url }) => {
        const feed = await fetchZotzFeedText(url, await this.readToken(id))
        const parsed = feed.ok ? parseZotzTasks(feed.text, feed.format) : null
        // Read after the download: a PR sync may have updated the entry meanwhile.
        const previous = cache[id]
        if (parsed?.ok === true) {
          cache[id] = {
            ...(previous ?? { verifiedActions: [], actionError: null, pullRequests: {} }),
            id,
            fetchedAt: Date.now(),
            document: parsed.document,
            rejected: parsed.rejected,
            error: null
          }
          await checkZotzConnectorActions(cache[id], await this.readToken(id))
        } else {
          // Keep showing the last good tasks while the service is down or sends a bad feed.
          cache[id] = {
            ...(previous ?? {
              id,
              fetchedAt: null,
              document: null,
              rejected: [],
              verifiedActions: [],
              actionError: null,
              pullRequests: {}
            }),
            error: feed.ok ? (parsed?.ok === false ? parsed.error : null) : feed.error
          }
        }
      })
    )
    await this.write(this.cachePath, cache)
    return Object.values(cache).map(publicZotzConnectorSnapshot)
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
    const cache = await this.cache
    cache[id] = {
      ...(cache[id] ?? { pullRequests: {} }),
      id,
      fetchedAt: Date.now(),
      document: parsed.document,
      rejected: parsed.rejected,
      error: null,
      verifiedActions: [],
      actionError: null
    }
    await checkZotzConnectorActions(cache[id], await this.readToken(id))
    await this.write(this.cachePath, cache)
    return {
      ok: true,
      connector: { id, kind: 'file', name: parsed.document.source.name },
      snapshot: publicZotzConnectorSnapshot(cache[id])
    }
  }

  /**
   * Finds each task's pull requests in these repos and the ones its service declares, then
   * tells services that verified link-pr about every link that changed since the last call.
   */
  async syncPullRequests(repos: readonly string[]): Promise<ZotzTaskConnectorSnapshot[]> {
    const cache = await this.cache
    const connectors = Object.values(cache).filter((entry) => entry.document)
    if (connectors.length === 0) {
      return []
    }
    const declared = connectors.flatMap((entry) =>
      (entry.document?.tasks ?? []).flatMap((task) => task.pullRequests)
    )
    const recent = await fetchZotzRecentPullRequests([
      ...repos,
      ...declared.map((pullRequest) => pullRequest.repo)
    ])
    const known = new Set(
      recent.map((pullRequest) => `${pullRequest.repo.toLowerCase()}#${pullRequest.number}`)
    )
    const missing = declared.filter(
      (pullRequest) => !known.has(`${pullRequest.repo.toLowerCase()}#${pullRequest.number}`)
    )
    const pullRequests = [...recent, ...(await fetchZotzPullRequests(missing))]
    for (const { id } of connectors) {
      // A refresh during the GitHub reads may have replaced the entry; update the current one.
      const entry = cache[id]
      if (!entry?.document) {
        continue
      }
      entry.pullRequests = matchZotzTaskPullRequests(entry.document, pullRequests)
      applyZotzManualLinks(entry)
      await sendZotzConnectorLinks(entry, await this.readToken(entry.id))
    }
    await this.write(this.cachePath, cache)
    return Object.values(cache).map(publicZotzConnectorSnapshot)
  }

  /** Moves a task to another Status option on its service; the board only offers verified moves. */
  async move(
    id: string,
    taskId: string,
    optionId: string
  ): Promise<{ ok: true; snapshot: ZotzTaskConnectorSnapshot } | { ok: false; error: string }> {
    const cache = await this.cache
    const entry = cache[id]
    const task = entry?.document?.tasks.find((item) => item.id === taskId)
    const actionsUrl = entry?.document?.capabilities?.actionsUrl
    if (!entry || !task || !actionsUrl || !entry.verifiedActions.includes('move')) {
      return { ok: false, error: 'This service does not accept moves' }
    }
    const result = await postZotzTaskAction(actionsUrl, await this.readToken(id), {
      action: 'move',
      taskId,
      dryRun: false,
      field: 'Status',
      value: optionId
    })
    if (!result.ok) {
      return { ok: false, error: result.error }
    }
    task.fieldValues = { ...task.fieldValues, Status: optionId }
    await this.write(this.cachePath, cache)
    return { ok: true, snapshot: publicZotzConnectorSnapshot(entry) }
  }

  /** Turns a mention into a link and tells the service, like adding "Closes #N" on GitHub. */
  async linkPullRequest(
    id: string,
    taskId: string,
    url: string
  ): Promise<ZotzTaskConnectorSnapshot | null> {
    const cache = await this.cache
    const entry = cache[id]
    if (!entry) {
      return null
    }
    entry.manualLinks = [...new Set([...(entry.manualLinks ?? []), `${taskId}|${url}`])]
    applyZotzManualLinks(entry)
    await sendZotzConnectorLinks(entry, await this.readToken(entry.id))
    await this.write(this.cachePath, cache)
    return publicZotzConnectorSnapshot(entry)
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
