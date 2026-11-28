import { join } from 'node:path'
import { readJsonFile, SerialJsonWriter } from '../zotz-json-file'
import {
  parseZotzTasks,
  ZOTZ_TASKS_MAX_BYTES,
  type ZotzTasksFormat
} from '../../../shared/zotz/tasks/zotz-tasks-contract'
import type { ZotzTaskConnectorImportResult } from '../../../shared/zotz/tasks/zotz-task-connector-types'
import {
  ZOTZ_TASK_RELAY_OFF,
  zotzRelayEventsSchema,
  zotzRelayNoticeSchema,
  type ZotzRelayNotice,
  type ZotzTaskRelayConfig,
  type ZotzTaskRelayStatus,
  type ZotzTaskRelayUpdate
} from '../../../shared/zotz/tasks/zotz-task-relay-types'
import { zotzTasksFormatFromResponse } from './zotz-task-feed'
import { ZotzTaskSecretFile } from './zotz-task-secret-file'

const STATE_FILE = 'zotz-task-relay.json'
const SECRETS_FILE = 'zotz-task-relay-secrets.json'
const TOKEN_ID = 'device'
/** Long-poll while a board is open; the relay caps it at its own limit. */
const LONG_POLL_SECONDS = 25
/** Board closed: only pick up providers' documents, which wait 24 h on the relay. */
const IDLE_MS = 10 * 60_000
const REQUEST_TIMEOUT_MS = 15_000
const MAX_BACKOFF_MS = 5 * 60_000

export type ZotzTaskRelayDeps = {
  userDataPath: string
  readConfig: () => ZotzTaskRelayConfig | null
  /** Same path as `zotz tasks push`. */
  importDocument: (
    text: string,
    format: ZotzTasksFormat | 'auto'
  ) => Promise<ZotzTaskConnectorImportResult>
  publish: (update: ZotzTaskRelayUpdate) => void
  /** Every batch of notices, board open or not (flows react to PR notices). */
  onNotices?: (notices: ZotzRelayNotice[]) => void
}

function relayUrl(base: string, path: string, params: Record<string, string> = {}): string {
  const url = new URL(path, base.endsWith('/') ? base : `${base}/`)
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value)
  }
  return url.toString()
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Pulls notices from the user's own zotz-relay over outgoing HTTPS only: long-poll while a board
 * is open, a quick check every 10 min otherwise. Electron-free; the IPC layer wires it up.
 */
export class ZotzTaskRelayClient {
  private readonly secrets: ZotzTaskSecretFile
  private readonly statePath: string
  private readonly writer = new SerialJsonWriter()
  private state: { url: string; cursor: string | null } | null = null
  private status: ZotzTaskRelayStatus = ZOTZ_TASK_RELAY_OFF
  private running = false
  private watching = false
  private failures = 0
  private wake: (() => void) | null = null
  private inflight: AbortController | null = null

  constructor(private readonly deps: ZotzTaskRelayDeps) {
    this.secrets = new ZotzTaskSecretFile(join(deps.userDataPath, SECRETS_FILE))
    this.statePath = join(deps.userDataPath, STATE_FILE)
  }

  start(): void {
    if (!this.running) {
      this.running = true
      void this.loop()
    }
  }

  stop(): void {
    this.running = false
    this.interrupt()
  }

  getStatus(): ZotzTaskRelayStatus {
    return this.status
  }

  /** A board opened or closed somewhere; switches between long-poll and the idle check. */
  setWatching(watching: boolean): void {
    if (watching !== this.watching) {
      this.watching = watching
      this.interrupt()
    }
  }

  /** Settings changed: drop the current wait and start again with the new config. */
  restart(): void {
    this.failures = 0
    this.interrupt()
  }

  async setToken(token: string | null): Promise<boolean> {
    const saved = await this.secrets.set(TOKEN_ID, token)
    this.restart()
    return saved
  }

  /** Asks the relay once with the stored token, for Settings' "Connect". */
  async check(url: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const token = await this.secrets.read(TOKEN_ID)
    if (!token) {
      return { ok: false, error: 'No device token saved' }
    }
    try {
      await this.request(relayUrl(url, 'v1/events', { wait: '0' }), token)
      return { ok: true }
    } catch (error) {
      return { ok: false, error: errorText(error) }
    }
  }

  private interrupt(): void {
    this.inflight?.abort()
    this.wake?.()
  }

  private sleep(ms: number | null): Promise<void> {
    return new Promise((resolve) => {
      const timer = ms === null ? null : setTimeout(() => this.wake?.(), ms)
      this.wake = () => {
        if (timer) {
          clearTimeout(timer)
        }
        this.wake = null
        resolve()
      }
    })
  }

  private setStatus(next: Omit<ZotzTaskRelayStatus, 'checkedAt'>): void {
    const changed = next.state !== this.status.state || next.error !== this.status.error
    this.status = { ...next, checkedAt: next.state === 'off' ? null : Date.now() }
    if (changed) {
      this.deps.publish({ status: this.status, notices: [], reset: false })
    }
  }

  private async loop(): Promise<void> {
    while (this.running) {
      const config = this.deps.readConfig()
      const token = config?.enabled ? await this.secrets.read(TOKEN_ID) : null
      if (!config?.enabled || !token) {
        this.setStatus({ state: 'off', error: null })
        await this.sleep(null)
        continue
      }
      const outcome = await this.poll(config.url, token)
      if (outcome === 'ok') {
        this.failures = 0
        if (!this.watching) {
          await this.sleep(IDLE_MS)
        }
      } else if (outcome === 'failed') {
        this.failures += 1
        await this.sleep(Math.min(MAX_BACKOFF_MS, 15_000 * 2 ** (this.failures - 1)))
      }
    }
  }

  private async poll(url: string, token: string): Promise<'ok' | 'failed' | 'aborted'> {
    const state = await this.readState(url)
    const wait = this.watching ? LONG_POLL_SECONDS : 0
    const controller = new AbortController()
    this.inflight = controller
    try {
      const body = await this.request(
        relayUrl(url, 'v1/events', {
          wait: String(wait),
          ...(state.cursor ? { cursor: state.cursor } : {})
        }),
        token,
        controller.signal,
        (wait + 15) * 1000
      )
      this.inflight = null
      const parsed = zotzRelayEventsSchema.safeParse(body)
      if (!parsed.success) {
        throw new Error('The relay sent an answer Zotz does not understand')
      }
      const notices = parsed.data.notices.flatMap((value): ZotzRelayNotice[] => {
        const notice = zotzRelayNoticeSchema.safeParse(value)
        return notice.success ? [notice.data] : []
      })
      for (const notice of notices) {
        if (notice.kind === 'source_push') {
          await this.deliverDocument(url, token, notice)
        }
      }
      // Saved only after documents are in, so a crash re-delivers instead of losing them.
      await this.saveState(url, parsed.data.cursor)
      this.setStatus({ state: 'live', error: null })
      const forBoard = notices.filter((notice) => notice.kind !== 'source_push')
      if (forBoard.length > 0) {
        this.deps.onNotices?.(forBoard)
      }
      // The first connection always resets; that's not news, the board just loaded.
      const reset = parsed.data.reset && state.cursor !== null
      if (this.watching && (forBoard.length > 0 || reset)) {
        this.deps.publish({ status: this.status, notices: forBoard, reset })
      }
      return 'ok'
    } catch (error) {
      if (controller.signal.aborted) {
        return 'aborted'
      }
      this.setStatus({ state: 'failing', error: errorText(error) })
      return 'failed'
    } finally {
      this.inflight = null
    }
  }

  /** Imports a provider's pushed document, then confirms it so the relay deletes it. */
  private async deliverDocument(
    url: string,
    token: string,
    notice: ZotzRelayNotice
  ): Promise<void> {
    const sourceId = notice.sourceId
    if (!sourceId) {
      return
    }
    const documentUrl = relayUrl(url, `v1/sources/${sourceId}/document`)
    const response = await fetch(documentUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
    if (response.status === 404) {
      // Already confirmed by another device or older than 24 h.
      return
    }
    if (!response.ok) {
      throw new Error(`The relay answered HTTP ${response.status} for a document`)
    }
    const documentId = response.headers.get('x-zotz-document-id') ?? ''
    const text = await response.text()
    const format = zotzTasksFormatFromResponse(documentUrl, response.headers.get('content-type'))
    const parsed = text.length <= ZOTZ_TASKS_MAX_BYTES ? parseZotzTasks(text, format) : null
    // The relay token proves the sender owns sourceId; it may not overwrite another service.
    if (parsed?.ok === true && parsed.document.source.id === sourceId) {
      await this.deps.importDocument(text, format)
    } else {
      console.warn(`[zotz-relay] Ignored a document pushed for ${sourceId}`)
    }
    // Confirm a bad document too: it would fail the same way on every retry.
    await fetch(relayUrl(url, `v1/sources/${sourceId}/document`, { id: documentId }), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    }).catch(() => undefined)
  }

  private async request(
    url: string,
    token: string,
    signal?: AbortSignal,
    timeoutMs = REQUEST_TIMEOUT_MS
  ): Promise<unknown> {
    const timeout = AbortSignal.timeout(timeoutMs)
    let response: Response
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout
      })
    } catch (error) {
      if (timeout.aborted) {
        throw new Error('The relay did not answer in time')
      }
      throw signal?.aborted ? error : new Error(`Could not reach the relay: ${errorText(error)}`)
    }
    if (response.status === 401) {
      throw new Error('The relay did not accept the device token')
    }
    if (!response.ok) {
      throw new Error(`The relay answered HTTP ${response.status}`)
    }
    return response.json()
  }

  private async readState(url: string): Promise<{ url: string; cursor: string | null }> {
    if (!this.state) {
      const stored = await readJsonFile(this.statePath)
      const value = typeof stored === 'object' && stored !== null ? stored : {}
      this.state = {
        url: 'url' in value && typeof value.url === 'string' ? value.url : '',
        cursor: 'cursor' in value && typeof value.cursor === 'string' ? value.cursor : null
      }
    }
    // A cursor only means something on the relay that issued it.
    return this.state.url === url ? this.state : { url, cursor: null }
  }

  private async saveState(url: string, cursor: string): Promise<void> {
    this.state = { url, cursor }
    await this.writer.write(this.statePath, this.state)
  }
}
