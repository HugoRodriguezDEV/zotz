import { isZotzOrcaCloudHost } from '../../../shared/zotz/zotz-network-policy'
import {
  ZotzFlowStepError,
  type ZotzFlowHttpRequest,
  type ZotzFlowHttpResponse
} from './zotz-flow-executor-types'

const MAX_BODY_CHARS = 1024 * 1024

const MAX_REDIRECTS = 5

function checkedUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new ZotzFlowStepError(`"${raw}" is not a valid URL.`, 'invalid_url')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ZotzFlowStepError('Only http and https addresses are allowed.', 'invalid_url')
  }
  if (isZotzOrcaCloudHost(url.hostname)) {
    throw new ZotzFlowStepError(
      'Zotz does not contact Orca services; this address is blocked by the network policy.',
      'blocked_by_network_policy'
    )
  }
  return url
}

/** HTTP step (spec §4.3): only http(s), and no hop reaches Orca/StablyAI services (network policy). */
export async function fetchZotzFlowHttp(
  request: ZotzFlowHttpRequest
): Promise<ZotzFlowHttpResponse> {
  let url = checkedUrl(request.url)
  let method = request.method
  let body = method === 'GET' ? undefined : request.body
  try {
    for (let hop = 0; ; hop++) {
      const response = await fetch(url, {
        method,
        headers: request.headers,
        body,
        signal: request.signal,
        // Each redirect is checked against the policy before it is followed.
        redirect: 'manual'
      })
      const location = response.headers.get('location')
      if (response.status >= 300 && response.status < 400 && location && hop < MAX_REDIRECTS) {
        url = checkedUrl(new URL(location, url).toString())
        if (
          response.status === 303 ||
          ((response.status === 301 || response.status === 302) && method === 'POST')
        ) {
          method = 'GET'
          body = undefined
        }
        continue
      }
      const text = await response.text()
      return {
        status: response.status,
        body: text.length > MAX_BODY_CHARS ? text.slice(0, MAX_BODY_CHARS) : text,
        truncated: text.length > MAX_BODY_CHARS
      }
    }
  } catch (error) {
    if (request.signal.aborted) {
      throw request.signal.reason
    }
    if (error instanceof ZotzFlowStepError) {
      throw error
    }
    throw new ZotzFlowStepError(
      `The request failed: ${error instanceof Error ? error.message : String(error)}`,
      'http_failed'
    )
  }
}
