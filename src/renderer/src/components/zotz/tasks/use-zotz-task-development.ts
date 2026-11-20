import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ZotzTaskBoardItem } from '../../../../../shared/zotz/tasks/zotz-task-board-columns'
import {
  zotzIssueRefKey,
  type ZotzIssueRef,
  type ZotzTaskDevelopment
} from '../../../../../shared/zotz/tasks/zotz-task-development-types'

const FRESH_MS = 5 * 60_000

// Shared across modal openings so reopening the board does not refetch fresh data.
const cache = new Map<string, ZotzTaskDevelopment>()

export function githubIssueRef(item: ZotzTaskBoardItem): ZotzIssueRef | null {
  if (item.origin.kind !== 'github') {
    return null
  }
  const { row } = item.origin
  return row.itemType === 'ISSUE' && row.content.repository && row.content.number != null
    ? { repo: row.content.repository, number: row.content.number }
    : null
}

/** Pull requests and branches of a card: GitHub's own links for issues, Zotz's matches for services. */
export function zotzTaskDevelopment(
  item: ZotzTaskBoardItem,
  byIssue: ReadonlyMap<string, ZotzTaskDevelopment>
): ZotzTaskDevelopment | null {
  if (item.origin.kind === 'external') {
    const matches = item.origin.source.pullRequests?.[item.origin.task.id] ?? []
    return {
      linked: matches.filter((match) => match.link === 'linked').map((match) => match.pullRequest),
      mentioned: matches
        .filter((match) => match.link === 'mentioned')
        .map((match) => match.pullRequest),
      branches: [],
      verifiedAt: 0
    }
  }
  const ref = githubIssueRef(item)
  return ref ? (byIssue.get(zotzIssueRefKey(ref)) ?? null) : null
}

/** Loads Development for the GitHub issues on the board; `revision` forces a refetch. */
export function useZotzIssueDevelopment(
  items: readonly ZotzTaskBoardItem[],
  active: boolean,
  revision: number
): ReadonlyMap<string, ZotzTaskDevelopment> {
  const [, setVersion] = useState(0)
  const refs = useMemo(() => {
    const unique = new Map<string, ZotzIssueRef>()
    for (const item of items) {
      const ref = githubIssueRef(item)
      if (ref) {
        unique.set(zotzIssueRefKey(ref), ref)
      }
    }
    return [...unique.values()]
  }, [items])
  const refsKey = refs.map(zotzIssueRefKey).join(',')

  useEffect(() => {
    const api = window.api?.zotzTaskConnectors
    if (!active || !api || refs.length === 0) {
      return
    }
    const now = Date.now()
    const stale = refs.filter((ref) => {
      const known = cache.get(zotzIssueRefKey(ref))
      return revision > 0 || !known || now - known.verifiedAt > FRESH_MS
    })
    if (stale.length === 0) {
      return
    }
    let canceled = false
    void api.development(stale).then(
      (result) => {
        for (const [key, value] of Object.entries(result)) {
          cache.set(key, value)
        }
        if (!canceled) {
          setVersion((version) => version + 1)
        }
      },
      () => undefined
    )
    return () => {
      canceled = true
    }
    // refsKey stands for refs: same issues, same request.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [active, refsKey, revision])

  return cache
}

export const ZotzIssueDevelopmentContext = createContext<ReadonlyMap<string, ZotzTaskDevelopment>>(
  new Map()
)

export function useZotzTaskDevelopmentFor(item: ZotzTaskBoardItem): ZotzTaskDevelopment | null {
  return zotzTaskDevelopment(item, useContext(ZotzIssueDevelopmentContext))
}
