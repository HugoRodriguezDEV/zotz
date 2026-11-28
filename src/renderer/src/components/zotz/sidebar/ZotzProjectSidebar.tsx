import React, { useEffect, useMemo, useState } from 'react'
import { useContextualTour } from '../../contextual-tours/use-contextual-tour'
import { useAppStore } from '@/store/index'
import { useTranslate } from '@/i18n/use-translate'
import type { AgentDotState } from '@/components/AgentStateDot'
import type { AgentType } from '../../../../../shared/agent-status/contracts/agent-status-types'
import { activityThreadStatusId } from '@/components/activity/activity-thread-presentation'
import { useAllAgentPaneThreads } from '@/components/activity/use-agent-pane-threads'
import {
  selectFolderWorkspaces,
  selectWorktreesByRepo
} from '@/store/workspaces/catalog/workspace-record-fields'
import type { Repo } from '../../../../../shared/repository/repo-types'
import {
  LOCAL_EXECUTION_HOST_ID,
  getRepoExecutionHostId
} from '../../../../../shared/execution-host'
import {
  buildZotzFolderConversations,
  buildZotzGroupSections,
  buildZotzProjectSections,
  buildZotzShortNames,
  nestZotzChildren,
  summarizeZotzConversationStatus,
  zotzMemberKey,
  type ZotzConversationRow as ConversationRow,
  type ZotzConversationStatus
} from './zotz-project-conversations'
import { ZotzConversationTree, zotzRowMember } from './ZotzConversationTree'
import { getProjectIdentityKey } from '../../../../../shared/project/host-setup/project-host-setup-projection'
import { ZotzProjectDropZone, ZotzSidebarGroups, useZotzSidebarGroups } from './ZotzSidebarGroups'
import { sortZotzGroups } from '../links/zotz-link-groups'
import { useZotzGitHubRepoIcons } from './use-zotz-github-repo-icons'
import { useZotzAgentQueue } from '../agent-queue/zotz-agent-queue-store'
import { useZotzHostAgentQueues } from '../agent-queue/zotz-host-agent-queue-store'
import { ZotzConversationMenu } from './ZotzConversationMenu'
import { AddProjectButton, ProjectHeader } from './ZotzProjectHeader'
import HiddenProjectsSection from '../../sidebar/hidden-projects/HiddenProjectsSection'
import { ZotzConversationRow } from './ZotzConversationRow'
import { ZotzFlashSessions } from './ZotzFlashSessions'
import { ZotzMachineSubgroups } from './ZotzMachineSubgroups'
import { useZotzHostPalette } from '../host-color/use-zotz-host-color'
import { ZotzArchivedSection } from './ZotzArchivedSection'
import { ZotzShortNameDialog, type ZotzShortNameRequest } from './ZotzShortNameDialog'
import { canEditZotzShortName, useZotzCustomShortNames } from './zotz-short-name-store'
import type { Worktree } from '../../../../../shared/worktree/types'

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
    const threadsByWorkspace = new Map<
      string,
      { state: AgentDotState; unread: boolean; agentType: AgentType }[]
    >()
    for (const thread of allThreads) {
      const list = threadsByWorkspace.get(thread.worktree.id) ?? []
      list.push({
        state: activityThreadStatusId(thread),
        unread: thread.unread,
        agentType: thread.agentType
      })
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
  const hostColorOf = useZotzHostPalette()
  const groupByMachine = useAppStore((s) => s.settings?.zotzGroupRemoteByMachine !== false)
  const links = useAppStore((s) => s.settings?.zotzConversationLinks)
  const groups = useMemo(() => sortZotzGroups(links ?? []), [links])
  const linkedKeys = useMemo(
    () =>
      new Set(groups.flatMap((group) => group.members.map((m) => zotzMemberKey(m.hostId, m.path)))),
    [groups]
  )
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
        shortNames,
        grouped: linkedKeys
      }),
    [
      repos,
      worktreesByRepo,
      statusByWorkspace,
      canceledWorkspaces,
      queuedSince,
      shortNames,
      linkedKeys
    ]
  )
  const groupSections = useMemo(
    () => buildZotzGroupSections({ groups, repos, worktreesByRepoId: worktreesByRepo, shortNames }),
    [groups, repos, worktreesByRepo, shortNames]
  )
  const groupsUi = useZotzSidebarGroups(groups, shortNames)
  const nested = useMemo(
    () =>
      nestZotzChildren(
        groupSections.map((section) => section.conversations),
        sections.map((section) => section.conversations)
      ),
    [groupSections, sections]
  )
  const nestedGroups = groupSections.map((section, index) => ({
    ...section,
    conversations: nested.groupLists[index],
    total: section.conversations.length
  }))
  const nestedSections = sections.map((section, index) => ({
    ...section,
    conversations: nested.projectLists[index]
  }))
  const renderConversation = (
    row: ConversationRow,
    repo: Repo,
    options: { showHost: boolean; showProject: boolean }
  ): React.JSX.Element => (
    <ZotzConversationMenu
      key={row.id}
      worktree={row.worktree}
      onEditShortName={editShortName(repo, row.worktree)}
      groupMenu={groupsUi.groupMenuFor(row)}
    >
      <ZotzConversationRow
        row={row}
        repo={repo}
        showHost={options.showHost}
        projectName={options.showProject ? repo.displayName : null}
        active={row.id === activeWorktreeId}
        status={statusByWorkspace.get(row.id) ?? null}
        canceled={canceledWorkspaces.has(row.id)}
        queuedSince={queuedSince.get(row.id) ?? null}
        linked={
          !options.showProject &&
          row.worktree !== null &&
          linkedKeys.has(zotzMemberKey(row.hostId, row.worktree.path))
        }
      />
    </ZotzConversationMenu>
  )
  const renderProjectTree = (
    row: ConversationRow,
    key: string,
    repo: Repo,
    showHost: boolean
  ): React.JSX.Element => (
    <ZotzConversationTree
      key={row.id}
      row={row}
      childrenOf={nested.childrenOf}
      drag={groupsUi.drag}
      itemFor={(node, followers) => {
        const member = zotzRowMember(node)
        return member
          ? {
              kind: 'conversation',
              member,
              projectKey: node.repo ? getProjectIdentityKey(node.repo) : key,
              groupId: null,
              index: 0,
              followers
            }
          : null
      }}
      dropAtFor={() => undefined}
      render={(node) =>
        renderConversation(node, node.repo ?? repo, {
          showHost,
          // A child from another project says which one it is.
          showProject: node.repo !== null && node.repo.id !== repo.id && node !== row
        })
      }
    />
  )
  // Upstream refreshes PR status only for cards it reports as on screen; this list is the cards here.
  const setVisibleReviewIds = useAppStore((s) => s.setVisibleReviewCardWorktreeIds)
  const reviewIds = useMemo(
    () =>
      [...sections, ...groupSections].flatMap(({ conversations }) =>
        conversations.flatMap((row) => (row.worktree?.branch ? [row.worktree.id] : []))
      ),
    [sections, groupSections]
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

  const renderFolder = (row: ConversationRow): React.JSX.Element => (
    <React.Fragment key={`${row.hostId}:${row.id}`}>
      <ZotzConversationMenu worktree={row.folderWorktree ?? null}>
        <ZotzConversationRow
          row={row}
          repo={undefined}
          active={row.id === activeWorktreeId}
          status={statusByWorkspace.get(row.id) ?? null}
          canceled={canceledWorkspaces.has(row.id)}
          queuedSince={queuedSince.get(row.id) ?? null}
        />
      </ZotzConversationMenu>
      <ZotzFlashSessions workspaceId={row.id} hostId={row.hostId} />
    </React.Fragment>
  )

  const sectionHeader = (label: string, action: React.ReactNode): React.JSX.Element => (
    <div className="flex items-center justify-between px-2 pt-2 pb-1">
      <span className="font-zotz-display text-sm font-extrabold tracking-[0.02em] text-worktree-sidebar-foreground/75 subpixel-antialiased">
        {label}
      </span>
      {action}
    </div>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <ZotzSidebarGroups
          sections={nestedGroups}
          childrenOf={nested.childrenOf}
          ui={groupsUi}
          renderConversation={renderConversation}
          header={sectionHeader}
        />
        {sectionHeader(t('dashboard.sidebar.projects', 'Projects'), <AddProjectButton />)}
        {sections.length === 0 && folders.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">
            {t('zotz.sidebar.empty', 'Add a project from GitHub or a local folder to start.')}
          </p>
        ) : null}
        {nestedSections.map(({ key, repo, multiHost, conversations }) => (
          <ZotzProjectDropZone key={key} drag={groupsUi.drag} projectKey={key}>
            <ProjectHeader repo={repo} multiHost={multiHost} />
            {groupByMachine && multiHost ? (
              <ZotzMachineSubgroups
                rows={conversations}
                colorOf={hostColorOf}
                // Machines without a color of their own (WSL) keep their chip.
                render={(row) =>
                  renderProjectTree(
                    row,
                    key,
                    repo,
                    row.hostId !== LOCAL_EXECUTION_HOST_ID && hostColorOf(row.hostId) === null
                  )
                }
              />
            ) : (
              conversations.map((row) => renderProjectTree(row, key, repo, multiHost))
            )}
          </ZotzProjectDropZone>
        ))}
        {folders.length > 0 ? (
          <section className="mb-2">
            <div className="px-2 py-1.5 font-zotz-display text-sm font-extrabold tracking-[0.02em] text-worktree-sidebar-foreground/75 subpixel-antialiased">
              {t('zotz.sidebar.folders', 'Folders')}
            </div>
            {groupByMachine ? (
              <ZotzMachineSubgroups rows={folders} colorOf={hostColorOf} render={renderFolder} />
            ) : (
              folders.map(renderFolder)
            )}
          </section>
        ) : null}
      </div>
      <ZotzArchivedSection />
      <HiddenProjectsSection />
      <ZotzShortNameDialog request={shortNameRequest} onClose={() => setShortNameRequest(null)} />
      {groupsUi.nameDialog}
    </div>
  )
}
