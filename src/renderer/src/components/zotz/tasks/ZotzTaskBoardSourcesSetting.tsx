import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { SearchableSetting } from '../../settings/section-layout/SearchableSetting'
import { listAccessibleProjectsForRuntime } from '../../github-project/picker/project-picker-runtime'
import { projectViewErrorMessage } from '../../github-project/auth-errors/project-view-error-copy'
import type { GlobalSettings } from '../../../../../shared/global-settings-types'
import type {
  GitHubProjectOwnerType,
  GitHubProjectSummary
} from '../../../../../shared/github/projects/project-types'
import {
  readZotzTaskBoardSources,
  zotzTaskBoardSourceKey,
  type ZotzTaskBoardSource
} from '../../../../../shared/zotz/tasks/zotz-task-board-types'
import { hideBrokenImage } from './ZotzTaskCard'
import { githubOwnerAvatarUrl } from './zotz-task-card-view'

export const ZOTZ_TASK_BOARD_SOURCES_SECTION_ID = 'zotz-task-board-sources'

type OwnerGroup = {
  owner: string
  ownerType: GitHubProjectOwnerType
  host?: string
  projects: ZotzTaskBoardSource[]
}

function toSource(project: GitHubProjectSummary): ZotzTaskBoardSource {
  return {
    kind: 'github-project',
    owner: project.owner,
    ownerType: project.ownerType,
    number: project.number,
    title: project.title,
    ...(project.host ? { host: project.host } : {})
  }
}

/** Selected projects GitHub no longer lists stay visible so they can still be removed. */
function groupByOwner(
  projects: GitHubProjectSummary[],
  selected: ZotzTaskBoardSource[]
): OwnerGroup[] {
  const groups = new Map<string, OwnerGroup>()
  const seen = new Set<string>()
  const add = (source: ZotzTaskBoardSource): void => {
    const sourceKey = zotzTaskBoardSourceKey(source)
    if (seen.has(sourceKey)) {
      return
    }
    seen.add(sourceKey)
    const ownerKey = `${source.host ?? ''}/${source.ownerType}/${source.owner}`.toLowerCase()
    const group = groups.get(ownerKey) ?? {
      owner: source.owner,
      ownerType: source.ownerType,
      host: source.host,
      projects: []
    }
    group.projects.push(source)
    groups.set(ownerKey, group)
  }
  projects.map(toSource).forEach(add)
  selected.forEach(add)
  return [...groups.values()].sort((a, b) =>
    a.ownerType === b.ownerType ? a.owner.localeCompare(b.owner) : a.ownerType === 'user' ? -1 : 1
  )
}

/** Settings → Tasks: which organizations and GitHub Projects feed the Zotz task board. */
export function ZotzTaskBoardSourcesSetting({
  settings,
  updateSettings
}: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}): React.JSX.Element {
  const t = useTranslate()
  const selected = useMemo(
    () => readZotzTaskBoardSources(settings.zotzTaskBoardSources),
    [settings.zotzTaskBoardSources]
  )
  const selectedKeys = useMemo(() => new Set(selected.map(zotzTaskBoardSourceKey)), [selected])
  const [projects, setProjects] = useState<GitHubProjectSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [partialFailures, setPartialFailures] = useState<string[]>([])

  const load = useCallback((wake: boolean) => {
    setLoading(true)
    setError(null)
    listAccessibleProjectsForRuntime({ kind: 'local' }, 'github.com', { wake })
      .then((result) => {
        if (result.ok) {
          setProjects(result.projects)
          setPartialFailures((result.partialFailures ?? []).map((failure) => failure.owner))
        } else {
          setError(projectViewErrorMessage(result.error))
        }
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load(false)
  }, [load])

  const groups = useMemo(() => groupByOwner(projects, selected), [projects, selected])

  const setSelected = (next: ZotzTaskBoardSource[]): void => {
    updateSettings({ zotzTaskBoardSources: next })
  }
  const toggleProject = (source: ZotzTaskBoardSource, checked: boolean): void => {
    const key = zotzTaskBoardSourceKey(source)
    setSelected(
      checked
        ? [...selected.filter((item) => zotzTaskBoardSourceKey(item) !== key), source]
        : selected.filter((item) => zotzTaskBoardSourceKey(item) !== key)
    )
  }
  const toggleOwner = (group: OwnerGroup, checked: boolean): void => {
    const groupKeys = new Set(group.projects.map(zotzTaskBoardSourceKey))
    const rest = selected.filter((item) => !groupKeys.has(zotzTaskBoardSourceKey(item)))
    setSelected(checked ? [...rest, ...group.projects] : rest)
  }

  return (
    <SearchableSetting
      id={ZOTZ_TASK_BOARD_SOURCES_SECTION_ID}
      title={t('zotz.taskBoard.settings.title', 'Zotz task board')}
      description={t(
        'zotz.taskBoard.settings.description',
        'Choose the organizations and GitHub Projects whose tasks appear on the task board. Tasks are read-only in Zotz; edit them on GitHub.'
      )}
      keywords={['github', 'projects', 'kanban', 'board', 'tablero', 'tareas']}
      className="flex flex-col gap-3 py-4"
    >
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">
          {t('zotz.taskBoard.settings.title', 'Zotz task board')}
        </p>
        <span className="text-xs text-muted-foreground">
          {t('zotz.taskBoard.settings.selectedCount', '{{total}} selected', {
            total: selected.length
          })}
        </span>
        <Button
          variant="ghost"
          size="xs"
          type="button"
          className="ml-auto"
          onClick={() => load(true)}
          disabled={loading}
        >
          <RefreshCw className={cn('size-3', loading && 'animate-spin')} />
          {t('zotz.taskBoard.settings.reload', 'Reload from GitHub')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t(
          'zotz.taskBoard.settings.description',
          'Choose the organizations and GitHub Projects whose tasks appear on the task board. Tasks are read-only in Zotz; edit them on GitHub.'
        )}
      </p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {partialFailures.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t('zotz.taskBoard.settings.partialFailures', "Couldn't list projects for: {{owners}}", {
            owners: partialFailures.join(', ')
          })}
        </p>
      ) : null}
      {loading && groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t('zotz.taskBoard.settings.loading', 'Loading your GitHub Projects…')}
        </p>
      ) : null}
      {!loading && !error && groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t('zotz.taskBoard.settings.none', 'GitHub returned no Projects for your account.')}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        {groups.map((group) => {
          const checkedCount = group.projects.filter((project) =>
            selectedKeys.has(zotzTaskBoardSourceKey(project))
          ).length
          const ownerState =
            checkedCount === 0
              ? false
              : checkedCount === group.projects.length
                ? true
                : 'indeterminate'
          return (
            <div
              key={`${group.ownerType}/${group.owner}`}
              className="rounded-md border border-border/60"
            >
              <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
                <Checkbox
                  checked={ownerState}
                  onCheckedChange={(value) => toggleOwner(group, value === true)}
                />
                <img
                  src={githubOwnerAvatarUrl(group.owner, group.host)}
                  alt=""
                  onError={hideBrokenImage}
                  className="size-5 rounded-sm"
                />
                <span className="font-medium">{group.owner}</span>
                <span className="text-xs text-muted-foreground">
                  {group.ownerType === 'user'
                    ? t('zotz.taskBoard.settings.personal', 'Personal account')
                    : t('zotz.taskBoard.settings.organization', 'Organization')}
                </span>
              </label>
              <div className="flex flex-col gap-1 border-t border-border/60 px-3 py-2 pl-10">
                {group.projects.map((project) => (
                  <label
                    key={zotzTaskBoardSourceKey(project)}
                    className="flex cursor-pointer items-center gap-2 text-xs"
                  >
                    <Checkbox
                      checked={selectedKeys.has(zotzTaskBoardSourceKey(project))}
                      onCheckedChange={(value) => toggleProject(project, value === true)}
                    />
                    <span className="truncate">{project.title}</span>
                    <span className="text-muted-foreground">#{project.number}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </SearchableSetting>
  )
}
