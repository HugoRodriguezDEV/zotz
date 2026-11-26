import React, { useCallback } from 'react'
import { FolderPlus, Plus } from 'lucide-react'
import { useAppStore } from '@/store/index'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { RepoIconGlyph } from '@/components/repo/repo-icon'
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
import { useZotzHostColor } from '../host-color/use-zotz-host-color'
import { ZotzHostDot } from '../host-color/ZotzHostDot'
import { ZotzProjectMenu } from './ZotzProjectMenu'
import { formatZotzRepoSlug, useZotzRepoGitHubSlug } from '../repo-github/use-zotz-repo-github-slug'
import { ZotzRepoGitHubLink } from '../repo-github/ZotzRepoGitHubLink'

export function AddProjectButton(): React.JSX.Element {
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

export function ProjectHeader({
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
  const hostColor = useZotzHostColor(hostLabel ? hostId : null)
  const slug = useZotzRepoGitHubSlug(repo)
  // The folder name alone hides the repository when they differ (a clone renamed on disk).
  const showSlug = slug !== null && slug.repo.toLowerCase() !== repo.displayName.toLowerCase()
  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-worktree-sidebar-foreground/5">
      <RepoIconGlyph repoIcon={repo.repoIcon} className="size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-semibold text-worktree-sidebar-foreground">
            {repo.displayName}
          </span>
          {hostLabel && hostColor ? <ZotzHostDot color={hostColor} /> : null}
          {hostLabel ? (
            <ProjectHeaderHostLabel context={{ hostId, label: hostLabel, detail: hostLabel }} />
          ) : null}
        </div>
        {showSlug ? (
          <div
            className="truncate text-2xs text-worktree-sidebar-foreground/50"
            title={formatZotzRepoSlug(slug)}
          >
            {slug.repo}
          </div>
        ) : null}
      </div>
      {slug ? (
        <ZotzRepoGitHubLink slug={slug} className="text-worktree-sidebar-foreground/40" />
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
