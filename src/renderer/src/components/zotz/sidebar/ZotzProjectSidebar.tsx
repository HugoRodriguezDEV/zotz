import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useContextualTour } from '../../contextual-tours/use-contextual-tour'
import { FolderPlus, Plus } from 'lucide-react'
import { useAppStore } from '@/store/index'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { RepoIconGlyph } from '@/components/repo/repo-icon'
import type { AgentDotState } from '@/components/AgentStateDot'
import { GitHubIcon } from '@/components/icons/GitHubIcon'
import { activityThreadStatusId } from '@/components/activity/activity-thread-presentation'
import { useAllAgentPaneThreads } from '@/components/activity/use-agent-pane-threads'
import {
  selectFolderWorkspaces,
  selectWorktreesByRepo
} from '@/store/workspaces/catalog/workspace-record-fields'
import { AddProjectMenu } from '../../sidebar/project-admission/menu/AddProjectMenu'
import type { AddRepoDialogEntryRequest } from '../../sidebar/project-admission/dialog/add-repo-dialog-types'
import { openHeaderCreateComposer } from '../../sidebar/worktree-list/rows/header-create-workspace-target'
import type { Repo } from '../../../../../shared/repository/repo-types'
import {
  LOCAL_EXECUTION_HOST_ID,
  getRepoExecutionHostId
} from '../../../../../shared/execution-host'
import { selectExecutionHostDisplayLabel } from '@/runtime/hosts/display/execution-host-display-label'
import { ProjectHeaderHostLabel } from '../../sidebar/worktree-list/rows/ProjectHeaderHostLabel'
import {
  buildZotzFolderConversations,
  buildZotzProjectSections,
  buildZotzShortNames,
  summarizeZotzConversationStatus,
  type ZotzConversationStatus
} from './zotz-project-conversations'
import { useZotzGitHubRepoIcons } from './use-zotz-github-repo-icons'
import { useZotzAgentQueue } from '../agent-queue/zotz-agent-queue-store'
import { useZotzHostAgentQueues } from '../agent-queue/zotz-host-agent-queue-store'
import { ZotzConversationMenu } from './ZotzConversationMenu'
import { ZotzProjectMenu } from './ZotzProjectMenu'
import HiddenProjectsSection from '../../sidebar/hidden-projects/HiddenProjectsSection'
import { ZotzConversationRow } from './ZotzConversationRow'
import { ZotzArchivedSection } from './ZotzArchivedSection'
import { ZotzShortNameDialog, type ZotzShortNameRequest } from './ZotzShortNameDialog'
import { canEditZotzShortName, useZotzCustomShortNames } from './zotz-short-name-store'
import type { Worktree } from '../../../../../shared/worktree/types'

function AddProjectButton(): React.JSX.Element {
  const t = useTranslate()
  const openModal = useAppStore((s) => s.openModal)
  const label = t('auto.components.sidebar.SidebarHeader.addProject', 'Add project')
  const openEntryRequest = useCallback(
    (entryRequest: AddRepoDialogEntryRequest) => openModal('add-repo', { entryRequest }),
    [openModal]
  )
  return (
    <AddProjectMenu
      side="bottom"
      align="end"
      tooltipLabel={label}
      onOpenEntryRequest={openEntryRequest}
    >
      <Button variant="ghost" size="icon-xs" type="button" aria-label={label}>
        <FolderPlus className="size-3.5" />
      </Button>
    </AddProjectMenu>
  )
}

function ProjectHeader({
  repo,
  multiHost
}: {
  repo: Repo
  /** Copies on several machines: rows name their machine and "+" lets the composer pick one. */
  multiHost: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const label = t('zotz.sidebar.newConversationIn', 'New conversation in {{project}}', {
    project: repo.displayName
  })
  const hostId = getRepoExecutionHostId(repo)
  const hostLabel = useAppStore((s) =>
    multiHost || hostId === LOCAL_EXECUTION_HOST_ID
      ? null
      : selectExecutionHostDisplayLabel(s, hostId)
  )
  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-worktree-sidebar-foreground/5">
      <RepoIconGlyph repoIcon={repo.repoIcon} className="size-5 shrink-0" />
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="min-w-0 truncate text-sm font-semibold text-worktree-sidebar-foreground">
          {repo.displayName}
        </span>
        {hostLabel ? (
          <ProjectHeaderHostLabel context={{ hostId, label: hostLabel, detail: hostLabel }} />
        ) : null}
      </div>
      {repo.repoIcon?.type === 'image' && repo.repoIcon.source === 'github' ? (
        <GitHubIcon className="size-3.5 shrink-0 text-worktree-sidebar-foreground/40" />
      ) : null}
      <ZotzProjectMenu repo={repo} />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            type="button"
            aria-label={label}
            data-contextual-tour-target="zotz-project-new-conversation"
            onClick={() => openHeaderCreateComposer(repo, { pinHost: !multiHost })}
          >
            <Plus className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {label}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

/** Conductor-style sidebar: projects with "+", and under each only the conversations the user started. */
export default function ZotzProjectSidebar(): React.JSX.Element {
  const t = useTranslate()
  const repos = useAppStore((s) => s.repos)
  const worktreesByRepo = useAppStore((s) => selectWorktreesByRepo(s))
  const folderWorkspaces = useAppStore((s) => selectFolderWorkspaces(s))
  const tabsByWorktree = useAppStore((s) => s.tabsByWorktree)
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const { allThreads } = useAllAgentPaneThreads()
  const statusByWorkspace = useMemo(() => {
    const threadsByWorkspace = new Map<string, { state: AgentDotState; unread: boolean }[]>()
    for (const thread of allThreads) {
      const list = threadsByWorkspace.get(thread.worktree.id) ?? []
      list.push({ state: activityThreadStatusId(thread), unread: thread.unread })
      threadsByWorkspace.set(thread.worktree.id, list)
    }
    const result = new Map<string, ZotzConversationStatus>()
    for (const [id, threads] of threadsByWorkspace) {
      const status = summarizeZotzConversationStatus(threads)
      if (status) {
        result.set(id, status)
      }
    }
    return result
  }, [allThreads])
  useZotzGitHubRepoIcons(repos)
  useContextualTour('zotz-sidebar', repos.length > 0)
  useContextualTour(
    'zotz-background',
    [...statusByWorkspace.values()].some((status) => status.state === 'monitoring')
  )
  const queueSnapshot = useZotzAgentQueue()
  const hostQueues = useZotzHostAgentQueues()
  // Workspace ids are the same on every machine, so this machine's queue and each server's merge by label.
  const allQueues = useMemo(
    () => [queueSnapshot, ...hostQueues.values()],
    [queueSnapshot, hostQueues]
  )
  const canceledWorkspaces = useMemo(
    () => new Set(allQueues.flatMap((queue) => queue.canceled.map((launch) => launch.label))),
    [allQueues]
  )
  // Oldest wait per workspace: its agent has not started, whatever its threads say.
  const queuedSince = useMemo(() => {
    const result = new Map<string, number>()
    for (const task of allQueues.flatMap((queue) => queue.queued)) {
      result.set(task.label, Math.min(result.get(task.label) ?? Infinity, task.enqueuedAt))
    }
    return result
  }, [allQueues])

  const hostIds = useMemo(() => [...new Set(repos.map(getRepoExecutionHostId))], [repos])
  const customShortNames = useZotzCustomShortNames(hostIds)
  const shortNames = useMemo(
    () =>
      buildZotzShortNames({
        repos,
        worktreesByRepoId: worktreesByRepo,
        customByHost: customShortNames
      }),
    [repos, worktreesByRepo, customShortNames]
  )
  const [shortNameRequest, setShortNameRequest] = useState<ZotzShortNameRequest | null>(null)
  const editShortName = (repo: Repo, worktree: Worktree | null): (() => void) | undefined => {
    const hostId = getRepoExecutionHostId(repo)
    const current = worktree ? shortNames.get(worktree.id) : undefined
    if (!worktree || !current || !canEditZotzShortName(hostId)) {
      return undefined
    }
    return () => {
      const sameHost = repos.filter((other) => getRepoExecutionHostId(other) === hostId)
      const taken = new Set(
        sameHost.flatMap((other) =>
          (worktreesByRepo[other.id] ?? []).flatMap((candidate) => {
            const name = candidate.id === worktree.id ? undefined : shortNames.get(candidate.id)
            return name ? [name] : []
          })
        )
      )
      setShortNameRequest({
        hostId,
        path: worktree.path,
        current,
        isCustom: customShortNames.get(hostId)?.[worktree.path] !== undefined,
        taken
      })
    }
  }

  const sections = useMemo(
    () =>
      buildZotzProjectSections({
        repos,
        worktreesByRepoId: worktreesByRepo,
        workspacesWithAgents: new Set([
          ...statusByWorkspace.keys(),
          ...canceledWorkspaces,
          ...queuedSince.keys()
        ]),
        shortNames
      }),
    [repos, worktreesByRepo, statusByWorkspace, canceledWorkspaces, queuedSince, shortNames]
  )
  // Upstream refreshes PR status only for cards it reports as on screen; this list is the cards here.
  const setVisibleReviewIds = useAppStore((s) => s.setVisibleReviewCardWorktreeIds)
  const reviewIds = useMemo(
    () =>
      sections.flatMap(({ conversations }) =>
        conversations.flatMap((row) => (row.worktree?.branch ? [row.worktree.id] : []))
      ),
    [sections]
  )
  useEffect(() => {
    const publish = (): void =>
      setVisibleReviewIds(document.visibilityState === 'visible' ? reviewIds : [])
    publish()
    document.addEventListener('visibilitychange', publish)
    return () => {
      document.removeEventListener('visibilitychange', publish)
      setVisibleReviewIds([])
    }
  }, [reviewIds, setVisibleReviewIds])

  const folders = useMemo(
    () =>
      buildZotzFolderConversations({ folders: folderWorkspaces, tabsByWorkspace: tabsByWorktree }),
    [folderWorkspaces, tabsByWorktree]
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between px-4 pt-2 pb-1">
        <span className="text-xs font-medium text-worktree-sidebar-foreground/60">
          {t('dashboard.sidebar.projects', 'Projects')}
        </span>
        <AddProjectButton />
      </div>
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {sections.length === 0 && folders.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">
            {t('zotz.sidebar.empty', 'Add a project from GitHub or a local folder to start.')}
          </p>
        ) : null}
        {sections.map(({ key, repo, multiHost, conversations }) => (
          <section key={key} className="mb-2">
            <ProjectHeader repo={repo} multiHost={multiHost} />
            {conversations.map((row) => (
              <ZotzConversationMenu
                key={row.id}
                worktree={row.worktree}
                onEditShortName={editShortName(row.repo ?? repo, row.worktree)}
              >
                <ZotzConversationRow
                  row={row}
                  repo={row.repo ?? repo}
                  showHost={multiHost}
                  active={row.id === activeWorktreeId}
                  status={statusByWorkspace.get(row.id) ?? null}
                  canceled={canceledWorkspaces.has(row.id)}
                  queuedSince={queuedSince.get(row.id) ?? null}
                />
              </ZotzConversationMenu>
            ))}
          </section>
        ))}
        {folders.length > 0 ? (
          <section className="mb-2">
            <div className="px-2 py-1.5 text-sm font-semibold text-worktree-sidebar-foreground">
              {t('zotz.sidebar.folders', 'Folders')}
            </div>
            {folders.map((row) => (
              <ZotzConversationRow
                key={row.id}
                row={row}
                repo={undefined}
                active={row.id === activeWorktreeId}
                status={statusByWorkspace.get(row.id) ?? null}
                canceled={canceledWorkspaces.has(row.id)}
                queuedSince={queuedSince.get(row.id) ?? null}
              />
            ))}
          </section>
        ) : null}
      </div>
      <ZotzArchivedSection />
      <HiddenProjectsSection />
      <ZotzShortNameDialog request={shortNameRequest} onClose={() => setShortNameRequest(null)} />
    </div>
  )
}
