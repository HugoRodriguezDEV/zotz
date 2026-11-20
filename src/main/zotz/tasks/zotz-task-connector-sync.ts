import type { ZotzMatchedPullRequest } from '../../../shared/zotz/tasks/zotz-task-pr-matching'
import { postZotzTaskAction } from './zotz-task-actions'
import type { StoredZotzConnector } from './zotz-task-connector-record'

/** Actions Zotz knows how to send; anything else a service declares is ignored. */
const KNOWN_ACTIONS = ['link-pr', 'move'] as const

function linkSignature(match: ZotzMatchedPullRequest): string {
  const { pullRequest } = match
  return [
    match.link,
    pullRequest.state,
    pullRequest.isDraft,
    pullRequest.mergeCommit?.oid ?? ''
  ].join('|')
}

/** Dry-runs each declared action once per actionsUrl + action list (§7.4). */
export async function checkZotzConnectorActions(
  entry: StoredZotzConnector,
  token: string | null
): Promise<void> {
  const capabilities = entry.document?.capabilities
  const declared = KNOWN_ACTIONS.filter((action) => capabilities?.actions.includes(action))
  const signature = capabilities ? `${capabilities.actionsUrl}|${declared.join(',')}` : ''
  if (signature === entry.actionsChecked) {
    return
  }
  entry.actionsChecked = signature
  entry.verifiedActions = []
  entry.actionError = null
  if (!capabilities || declared.length === 0) {
    return
  }
  const errors: string[] = []
  for (const action of declared) {
    const result = await postZotzTaskAction(capabilities.actionsUrl, token, {
      action,
      taskId: entry.document?.tasks[0]?.id ?? '',
      dryRun: true
    })
    if (result.ok) {
      entry.verifiedActions.push(action)
    } else {
      errors.push(`${action}: ${result.error}`)
    }
  }
  entry.actionError = errors.length > 0 ? errors.join('; ') : null
}

/** Tells a service that verified link-pr about every link that changed since the last call. */
export async function sendZotzConnectorLinks(
  entry: StoredZotzConnector,
  token: string | null
): Promise<void> {
  const actionsUrl = entry.document?.capabilities?.actionsUrl
  if (!actionsUrl || !entry.verifiedActions.includes('link-pr')) {
    return
  }
  const sent = entry.sentLinks ?? {}
  const current: Record<string, { taskId: string; match: ZotzMatchedPullRequest }> = {}
  for (const [taskId, matches] of Object.entries(entry.pullRequests)) {
    for (const match of matches) {
      current[`${taskId}|${match.pullRequest.url}`] = { taskId, match }
    }
  }
  for (const [key, { taskId, match }] of Object.entries(current)) {
    const signature = linkSignature(match)
    if (sent[key] === signature) {
      continue
    }
    const result = await postZotzTaskAction(actionsUrl, token, {
      action: 'link-pr',
      taskId,
      dryRun: false,
      pullRequest: {
        ...match.pullRequest,
        mergeCommit: match.pullRequest.mergeCommit?.oid ?? null,
        link: match.link
      }
    })
    // A failed send stays unsent, so the next sync retries it.
    if (result.ok) {
      sent[key] = signature
    }
  }
  for (const key of Object.keys(sent)) {
    if (current[key]) {
      continue
    }
    const [taskId = '', url = ''] = key.split('|')
    const result = await postZotzTaskAction(actionsUrl, token, {
      action: 'link-pr',
      taskId,
      dryRun: false,
      pullRequest: { url, link: 'unlinked' }
    })
    if (result.ok) {
      delete sent[key]
    }
  }
  entry.sentLinks = sent
}

/** Mentions the user linked by hand count as links. */
export function applyZotzManualLinks(entry: StoredZotzConnector): void {
  for (const key of entry.manualLinks ?? []) {
    const [taskId = '', url = ''] = key.split('|')
    const match = entry.pullRequests[taskId]?.find((item) => item.pullRequest.url === url)
    if (match) {
      match.link = 'linked'
    }
  }
}
