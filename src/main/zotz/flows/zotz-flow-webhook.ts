import { createHash, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http'
import type { ZotzFlowEventPayload } from './zotz-flow-event-dispatch'
import type { ZotzFlowStartResult } from './zotz-flow-service'

export const ZOTZ_FLOW_WEBHOOK_PATH = '/zotz/flows/hooks/'
export const ZOTZ_FLOW_WEBHOOK_TOKEN_HEADER = 'x-zotz-flow-token'
export const ZOTZ_FLOW_WEBHOOK_MAX_BODY_BYTES = 1024 * 1024
const MAX_TRIGGER_ID = 1024
// Never handed to the flow: they carry the token.
const SECRET_HEADERS = new Set([ZOTZ_FLOW_WEBHOOK_TOKEN_HEADER, 'authorization'])

export type ZotzFlowWebhookDeps = {
  /** The flow and token of a webhook trigger on this machine; null when there is none. */
  findTrigger: (triggerId: string) => { flowId: string; token: string } | null
  start: (
    flowId: string,
    trigger: { triggerId: string } & ZotzFlowEventPayload<'webhook'>
  ) => ZotzFlowStartResult
}

// Set by the flows startup; the HTTP server only imports this light module.
let registered: ZotzFlowWebhookDeps | null = null

export function registerZotzFlowWebhooks(deps: ZotzFlowWebhookDeps): () => void {
  registered = deps
  return () => {
    if (registered === deps) {
      registered = null
    }
  }
}

function reply(response: ServerResponse, status: number, body: Record<string, unknown>): void {
  if (response.headersSent || response.destroyed) {
    return
  }
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  })
  response.end(JSON.stringify(body))
}

function headerText(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

function givenToken(request: IncomingMessage): string {
  const own = headerText(request.headers[ZOTZ_FLOW_WEBHOOK_TOKEN_HEADER]).trim()
  if (own) {
    return own
  }
  const bearer = /^Bearer\s+(.+)$/i.exec(headerText(request.headers.authorization).trim())
  return bearer?.[1]?.trim() ?? ''
}

/** Compares digests so neither the length nor the content leaks through timing. */
function sameToken(given: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest()
  return timingSafeEqual(digest(given), digest(expected)) && given.length > 0
}

function forwardedHeaders(request: IncomingMessage): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(request.headers)) {
    if (value !== undefined && !SECRET_HEADERS.has(name)) {
      headers[name] = Array.isArray(value) ? value.join(', ') : value
    }
  }
  return headers
}

function readBody(request: IncomingMessage): Promise<Buffer | 'too_large'> {
  return new Promise((resolve, reject) => {
    const declared = Number(headerText(request.headers['content-length']))
    if (Number.isFinite(declared) && declared > ZOTZ_FLOW_WEBHOOK_MAX_BODY_BYTES) {
      resolve('too_large')
      return
    }
    const chunks: Buffer[] = []
    let size = 0
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > ZOTZ_FLOW_WEBHOOK_MAX_BODY_BYTES) {
        request.removeAllListeners('data')
        resolve('too_large')
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

async function handleWebhook(
  request: IncomingMessage,
  response: ServerResponse,
  triggerId: string,
  deps: ZotzFlowWebhookDeps | null
): Promise<void> {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    reply(response, 405, { error: 'Use POST.' })
    return
  }
  if (!deps) {
    reply(response, 503, { error: 'Flows are not running on this machine yet.' })
    return
  }
  const target =
    triggerId.length > 0 && triggerId.length <= MAX_TRIGGER_ID ? deps.findTrigger(triggerId) : null
  if (!target) {
    reply(response, 404, { error: 'No webhook trigger with this id on this machine.' })
    return
  }
  if (!sameToken(givenToken(request), target.token)) {
    reply(response, 401, { error: 'Missing or wrong token.' })
    return
  }
  const raw = await readBody(request)
  if (raw === 'too_large') {
    response.setHeader('Connection', 'close')
    reply(response, 413, { error: 'The body is larger than 1 MB.' })
    request.destroy()
    return
  }
  let body: unknown = null
  if (raw.length > 0) {
    try {
      body = JSON.parse(raw.toString('utf8'))
    } catch {
      reply(response, 400, { error: 'The body must be JSON.' })
      return
    }
  }
  const result = deps.start(target.flowId, {
    triggerId,
    kind: 'webhook',
    body,
    headers: forwardedHeaders(request)
  })
  if (!result.ok) {
    reply(response, result.reason === 'not_found' ? 404 : 409, { error: result.message })
    return
  }
  reply(response, 202, { runId: result.run.id, status: result.run.status })
}

/**
 * `POST /zotz/flows/hooks/<trigger id>` on the server `zotz serve` (and paired desktops) already
 * opens: same port, same Tailscale-only source guard. Every other request goes to `next`.
 */
export function withZotzFlowWebhooks(
  next: RequestListener,
  deps?: ZotzFlowWebhookDeps
): RequestListener {
  return (request, response) => {
    const path = (request.url ?? '').split('?')[0] ?? ''
    if (!path.startsWith(ZOTZ_FLOW_WEBHOOK_PATH)) {
      next(request, response)
      return
    }
    handleWebhook(
      request,
      response,
      path.slice(ZOTZ_FLOW_WEBHOOK_PATH.length),
      deps ?? registered
    ).catch((error: unknown) => {
      console.warn('[zotz-flows] webhook failed:', error)
      reply(response, 500, { error: 'The webhook could not be handled.' })
    })
  }
}
