import {
  ZOTZ_TASKS_MAX_BYTES,
  zotzTasksFormatFromName,
  type ZotzTasksFormat
} from '../../../shared/zotz/tasks/zotz-tasks-contract'

const FETCH_TIMEOUT_MS = 15_000

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
  return zotzTasksFormatFromName(new URL(url).pathname)
}

export async function fetchZotzFeedText(
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
