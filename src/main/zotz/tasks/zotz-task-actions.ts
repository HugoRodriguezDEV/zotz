import { ZOTZ_TASKS_SCHEMA } from '../../../shared/zotz/tasks/zotz-tasks-contract'

const ACTION_TIMEOUT_MS = 15_000
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000]

export type ZotzTaskActionResult = { ok: true } | { ok: false; error: string; retryable: boolean }

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function postOnce(
  url: string,
  token: string | null,
  body: Record<string, unknown>
): Promise<ZotzTaskActionResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ACTION_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ schema: ZOTZ_TASKS_SCHEMA, ...body }),
      signal: controller.signal
    })
    const payload: unknown = await response.json().catch(() => null)
    const answer = typeof payload === 'object' && payload !== null ? payload : {}
    if (response.ok && 'ok' in answer && answer.ok === true) {
      return { ok: true }
    }
    const error =
      'error' in answer && typeof answer.error === 'string'
        ? answer.error
        : `The service answered HTTP ${response.status}`
    return { ok: false, error, retryable: response.status >= 500 }
  } catch (error) {
    return {
      ok: false,
      error: controller.signal.aborted
        ? 'The service did not answer within 15 seconds'
        : `Could not reach the service: ${error instanceof Error ? error.message : String(error)}`,
      retryable: true
    }
  } finally {
    clearTimeout(timeout)
  }
}

/** Sends one zotz-tasks/v1 action; retries only network errors and 5xx, three times. */
export async function postZotzTaskAction(
  url: string,
  token: string | null,
  body: Record<string, unknown>
): Promise<ZotzTaskActionResult> {
  let result = await postOnce(url, token, body)
  for (const delay of RETRY_DELAYS_MS) {
    if (result.ok || !result.retryable) {
      return result
    }
    await wait(delay)
    result = await postOnce(url, token, body)
  }
  return result
}
