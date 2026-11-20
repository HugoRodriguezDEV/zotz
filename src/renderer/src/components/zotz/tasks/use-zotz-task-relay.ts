import { useEffect, useRef, useState } from 'react'
import {
  planZotzRelayReload,
  type ZotzRelayBoardSource
} from '../../../../../shared/zotz/tasks/zotz-task-relay-reload'
import {
  ZOTZ_TASK_RELAY_OFF,
  type ZotzRelayNotice,
  type ZotzTaskRelayStatus
} from '../../../../../shared/zotz/tasks/zotz-task-relay-types'
import type { ZotzIssueRef } from '../../../../../shared/zotz/tasks/zotz-task-development-types'
import { zotzTaskBoardSourceKey } from '../../../../../shared/zotz/tasks/zotz-task-board-types'
import type { ZotzTaskBoardSourceState } from './use-zotz-task-board-data'

/** With the relay live, the full refresh is only a safety net. */
const RELAY_FULL_REFRESH_MS = 30 * 60_000
const POLL_FULL_REFRESH_MS = 5 * 60_000
/** A push usually comes with PR and issue events; apply them together. */
const NOTICE_DEBOUNCE_MS = 1500

export type ZotzTaskRelayTargets = {
  githubStates: readonly ZotzTaskBoardSourceState[]
  /** Repos whose PRs services' tasks are matched against. */
  watchedRepos: readonly string[]
  refreshAll: () => void
  refreshSources: (keys: readonly string[]) => void
  reloadDevelopment: (refs: ZotzIssueRef[]) => void
  syncPullRequests: (repos: string[]) => void
}

function boardSources(states: readonly ZotzTaskBoardSourceState[]): ZotzRelayBoardSource[] {
  return states.map(({ source, table }) => ({
    key: zotzTaskBoardSourceKey(source),
    repo: source.kind === 'github-repo' ? source.repo : undefined,
    projectNodeId: source.kind === 'github-project' ? table?.project.id : undefined,
    items: (table?.rows ?? []).flatMap((row) =>
      row.content.repository && row.content.number != null
        ? [
            {
              repo: row.content.repository,
              number: row.content.number,
              isIssue: row.itemType === 'ISSUE'
            }
          ]
        : []
    )
  }))
}

/**
 * Keeps the open board in step with the user's relay: each notice rereads only what it touches,
 * and the full refresh runs every 30 min while the relay is live, every 5 min otherwise.
 */
export function useZotzTaskRelay(
  active: boolean,
  targets: ZotzTaskRelayTargets
): ZotzTaskRelayStatus {
  const [status, setStatus] = useState<ZotzTaskRelayStatus>(ZOTZ_TASK_RELAY_OFF)
  // Read at apply time so a debounced batch sees the board as it is then.
  const latest = useRef(targets)
  latest.current = targets
  const pending = useRef<{ notices: ZotzRelayNotice[]; reset: boolean }>({
    notices: [],
    reset: false
  })

  useEffect(() => {
    const api = window.api?.zotzTaskConnectors
    if (!api?.onRelay) {
      return
    }
    let timer: ReturnType<typeof setTimeout> | null = null
    const apply = (): void => {
      timer = null
      const { notices, reset } = pending.current
      pending.current = { notices: [], reset: false }
      const current = latest.current
      const plan = reset
        ? null
        : planZotzRelayReload(notices, {
            sources: boardSources(current.githubStates),
            watchedRepos: current.watchedRepos
          })
      if (!plan || plan.full) {
        current.refreshAll()
        return
      }
      current.refreshSources(plan.sourceKeys)
      current.reloadDevelopment(plan.developmentRefs)
      if (plan.connectorPullRequests) {
        current.syncPullRequests([...current.watchedRepos])
      }
    }
    void api.relayStatus().then(
      (value) => (value?.state ? setStatus(value) : undefined),
      () => undefined
    )
    const stop = api.onRelay((update) => {
      setStatus(update.status)
      if (update.notices.length === 0 && !update.reset) {
        return
      }
      pending.current.notices.push(...update.notices)
      pending.current.reset ||= update.reset
      timer ??= setTimeout(apply, NOTICE_DEBOUNCE_MS)
    })
    return () => {
      stop()
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [])

  useEffect(() => {
    const api = window.api?.zotzTaskConnectors
    if (!active || !api?.relayWatch) {
      return
    }
    void api.relayWatch(true).catch(() => undefined)
    return () => {
      void api.relayWatch(false).catch(() => undefined)
    }
  }, [active])

  // If the relay stops answering, its status turns 'failing' and this drops back to 5 min.
  const live = status.state === 'live'
  useEffect(() => {
    if (!active) {
      return
    }
    const timer = setInterval(
      () => latest.current.refreshAll(),
      live ? RELAY_FULL_REFRESH_MS : POLL_FULL_REFRESH_MS
    )
    return () => clearInterval(timer)
  }, [active, live])

  return status
}
