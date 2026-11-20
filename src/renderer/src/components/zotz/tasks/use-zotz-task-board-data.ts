import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store/index'
import { listProjectViewsForRuntime } from '../../github-project/picker/project-picker-runtime'
import { projectViewErrorMessage } from '../../github-project/auth-errors/project-view-error-copy'
import type { GetProjectViewTableResult } from '../../../../../shared/github/projects/project-result-types'
import type { GitHubProjectTable } from '../../../../../shared/github/projects/project-types'
import { zotzRepoIssuesTable } from '../../../../../shared/zotz/tasks/zotz-repo-issues'
import { asArray } from './zotz-task-bridge-results'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import {
  readZotzTaskBoardSources,
  zotzTaskBoardSourceKey,
  type ZotzTaskBoardProjectSource,
  type ZotzTaskBoardRepoSource,
  type ZotzTaskBoardSource
} from '../../../../../shared/zotz/tasks/zotz-task-board-types'

const LOCAL_TARGET: RuntimeClientTarget = { kind: 'local' }

export type ZotzTaskBoardSourceState = {
  source: ZotzTaskBoardSource
  loading: boolean
  /** Last good table; kept while a refresh runs or after it fails. */
  table: GitHubProjectTable | null
  error: string | null
}

type FetchProjectViewTable = ReturnType<typeof useAppStore.getState>['fetchProjectViewTable']

/** Roadmap views can't be read as a table, so fall back to the project's first board or table view. */
async function fetchSourceTable(
  fetchProjectViewTable: FetchProjectViewTable,
  source: ZotzTaskBoardProjectSource,
  force: boolean
): Promise<GetProjectViewTableResult> {
  const args = {
    owner: source.owner,
    ownerType: source.ownerType,
    projectNumber: source.number,
    ...(source.host ? { host: source.host } : {})
  }
  const first = await fetchProjectViewTable(LOCAL_TARGET, args, { force, wakeWslDistro: force })
  if (first.ok || first.error.type !== 'unsupported_layout') {
    return first
  }
  const views = await listProjectViewsForRuntime(LOCAL_TARGET, args)
  const view = views.ok ? views.views.find((item) => item.layout !== 'ROADMAP_LAYOUT') : undefined
  if (!view) {
    return first
  }
  return fetchProjectViewTable(LOCAL_TARGET, { ...args, viewId: view.id }, { force })
}

/** Loads every chosen project while the board is visible; `refresh` bypasses the cache. */
export function useZotzTaskBoardData(active: boolean): {
  sources: ZotzTaskBoardSource[]
  states: ZotzTaskBoardSourceState[]
  lastUpdatedAt: number | null
  refreshing: boolean
  refresh: () => void
} {
  const rawSources = useAppStore((s) => s.settings?.zotzTaskBoardSources)
  const fetchProjectViewTable = useAppStore((s) => s.fetchProjectViewTable)
  const sources = useMemo(() => readZotzTaskBoardSources(rawSources), [rawSources])
  const [byKey, setByKey] = useState<Record<string, ZotzTaskBoardSourceState>>({})
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const generation = useRef(0)

  const load = useCallback(
    (force: boolean) => {
      const current = ++generation.current
      // Marked once the request is under way, so a mount never renders a loading flash first.
      void Promise.resolve().then(() => {
        if (generation.current !== current) {
          return
        }
        setByKey((previous) => {
          const next: Record<string, ZotzTaskBoardSourceState> = {}
          for (const source of sources) {
            const key = zotzTaskBoardSourceKey(source)
            next[key] = {
              source,
              loading: true,
              table: previous[key]?.table ?? null,
              error: null
            }
          }
          return next
        })
      })
      const settle = (
        source: ZotzTaskBoardSource,
        state: Omit<ZotzTaskBoardSourceState, 'source' | 'loading'>
      ): void => {
        if (generation.current !== current) {
          return
        }
        const key = zotzTaskBoardSourceKey(source)
        setByKey((previous) => ({
          ...previous,
          [key]: {
            source,
            loading: false,
            table: state.table ?? previous[key]?.table ?? null,
            error: state.error
          }
        }))
      }
      const failure = (error: unknown) => ({
        table: null,
        error: error instanceof Error ? error.message : String(error)
      })
      const repoSources = sources.filter(
        (source): source is ZotzTaskBoardRepoSource => source.kind === 'github-repo'
      )
      const loadRepos = async (): Promise<void> => {
        const api = window.api?.zotzTaskConnectors
        if (repoSources.length === 0 || !api) {
          return
        }
        try {
          const found = asArray(await api.repoIssues(repoSources.map((source) => source.repo)))
          const byRepo = new Map(found.map((item) => [item.repo.toLowerCase(), item]))
          for (const source of repoSources) {
            const issues = byRepo.get(source.repo.toLowerCase())
            settle(
              source,
              issues
                ? { table: zotzRepoIssuesTable(issues), error: null }
                : {
                    table: null,
                    error: translate(
                      'zotz.taskBoard.repoMissing',
                      'GitHub did not return this repo'
                    )
                  }
            )
          }
        } catch (error) {
          repoSources.forEach((source) => settle(source, failure(error)))
        }
      }
      void Promise.all([
        loadRepos(),
        ...sources.map(async (source) => {
          if (source.kind !== 'github-project') {
            return
          }
          try {
            const result = await fetchSourceTable(fetchProjectViewTable, source, force)
            settle(
              source,
              result.ok
                ? { table: result.data, error: null }
                : { table: null, error: projectViewErrorMessage(result.error) }
            )
          } catch (error) {
            settle(source, failure(error))
          }
        })
      ]).then(() => {
        if (generation.current === current) {
          setLastUpdatedAt(Date.now())
        }
      })
    },
    [fetchProjectViewTable, sources]
  )

  useEffect(() => {
    if (active) {
      load(false)
    }
  }, [active, load])

  const states = useMemo(
    () =>
      sources
        .map((source) => byKey[zotzTaskBoardSourceKey(source)])
        .filter((state): state is ZotzTaskBoardSourceState => state !== undefined),
    [byKey, sources]
  )

  return {
    sources,
    states,
    lastUpdatedAt,
    refreshing: states.some((state) => state.loading),
    refresh: () => load(true)
  }
}
