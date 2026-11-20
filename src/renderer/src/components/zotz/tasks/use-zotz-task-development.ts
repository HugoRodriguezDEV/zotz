import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ZotzTaskBoardItem } from '../../../../../shared/zotz/tasks/zotz-task-board-columns'
import {
  zotzIssueRefKey,
  type ZotzIssueRef,
  type ZotzTaskDevelopment
} from '../../../../../shared/zotz/tasks/zotz-task-development-types'
import { asRecord } from './zotz-task-bridge-results'

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

/**
 * Loads Development for the GitHub issues on the board. A new `revision` refetches all of them;
 * `reload` refetches only some (relay notices).
 */
export function useZotzIssueDevelopment(
  items: readonly ZotzTaskBoardItem[],
  active: boolean,
  revision: number
): { byIssue: ReadonlyMap<string, ZotzTaskDevelopment>; reload: (refs: ZotzIssueRef[]) => void } {
  const [, setVersion] = useState(0)
  const [reloads, setReloads] = useState(0)
  const appliedRevision = useRef(revision)
  const forced = useRef(new Set<string>())
  // A string key keeps the request stable while the board re-renders with the same issues.
  const refsKey = useMemo(() => {
    const keys = new Set<string>()
    for (const item of items) {
      const ref = githubIssueRef(item)
      if (ref) {
        keys.add(zotzIssueRefKey(ref))
      }
    }
    return [...keys].join(',')
  }, [items])
  const refs = useMemo(
    () =>
      refsKey
        ? refsKey.split(',').map((key): ZotzIssueRef => {
            const hash = key.lastIndexOf('#')
            return { repo: key.slice(0, hash), number: Number(key.slice(hash + 1)) }
          })
        : [],
    [refsKey]
  )

  useEffect(() => {
    const api = window.api?.zotzTaskConnectors
    if (!active || !api || refs.length === 0) {
      return
    }
    const forceAll = appliedRevision.current !== revision
    appliedRevision.current = revision
    const now = Date.now()
    const stale = refs.filter((ref) => {
      const key = zotzIssueRefKey(ref)
      const known = cache.get(key)
      return forceAll || forced.current.has(key) || !known || now - known.verifiedAt > FRESH_MS
    })
    for (const ref of stale) {
      forced.current.delete(zotzIssueRefKey(ref))
    }
    if (stale.length === 0) {
      return
    }
    let canceled = false
    void api.development(stale).then(
      (result) => {
        for (const [key, value] of Object.entries(asRecord(result))) {
          cache.set(key, value)
        }
        if (!canceled) {
          setVersion((value) => value + 1)
        }
      },
      () => undefined
    )
    return () => {
      canceled = true
    }
  }, [active, refs, revision, reloads])

  const reload = useCallback((targets: ZotzIssueRef[]) => {
    if (targets.length === 0) {
      return
    }
    for (const ref of targets) {
      forced.current.add(zotzIssueRefKey(ref))
    }
    setReloads((value) => value + 1)
  }, [])

  return { byIssue: cache, reload }
}

export const ZotzIssueDevelopmentContext = createContext<ReadonlyMap<string, ZotzTaskDevelopment>>(
  new Map()
)

export function useZotzTaskDevelopmentFor(item: ZotzTaskBoardItem): ZotzTaskDevelopment | null {
  return zotzTaskDevelopment(item, useContext(ZotzIssueDevelopmentContext))
}
