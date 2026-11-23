import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Repo } from '../../../../../shared/repository/repo-types'
import type { ZotzLinkGroup } from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import { useZotzStoreLinkContext } from '../links/use-zotz-store-link-context'
import {
  createZotzGroupNamed,
  deleteZotzGroup,
  moveZotzConversationToGroup,
  renameZotzGroupNamed,
  unlinkZotzConversation,
  type ZotzLinkContext
} from '../links/zotz-link-actions'
import { findZotzLinkGroup } from '../links/zotz-link-groups'
import type { ZotzGroupMenu } from './ZotzConversationMenu'
import { ZotzGroupNameDialog, type ZotzGroupNameRequest } from './ZotzGroupNameDialog'
import { ZotzGroupSection, zotzGroupName } from './ZotzGroupSection'
import type {
  ZotzConversationRow as ConversationRow,
  ZotzGroupSection as GroupSection
} from './zotz-project-conversations'

function showError(error: unknown): void {
  toast.error(error instanceof Error ? error.message : String(error))
}

export type ZotzSidebarGroupsUi = {
  linkContext: ZotzLinkContext
  groupMenuFor: (row: ConversationRow) => ZotzGroupMenu | undefined
  askNewGroup: (then?: (groupId: string) => Promise<unknown>) => void
  rename: (group: ZotzLinkGroup) => void
  remove: (group: ZotzLinkGroup) => void
  nameDialog: React.JSX.Element
}

/** Group actions for the sidebar: create, rename, delete, and each row's "Move to group". */
export function useZotzSidebarGroups(
  groups: readonly ZotzLinkGroup[],
  shortNames: ReadonlyMap<string, string>
): ZotzSidebarGroupsUi {
  const t = useTranslate()
  const linkContext = useZotzStoreLinkContext(shortNames)
  const [request, setRequest] = useState<ZotzGroupNameRequest | null>(null)
  const unnamed = t('zotz.groups.unnamed', 'Unnamed group')
  const askNewGroup = (then?: (groupId: string) => Promise<unknown>): void =>
    setRequest({
      current: '',
      onSave: async (name) => {
        const id = await createZotzGroupNamed(name)
        await then?.(id)
      }
    })
  return {
    linkContext,
    askNewGroup,
    groupMenuFor: (row) => {
      if (!row.worktree) {
        return undefined
      }
      const member = { hostId: row.hostId, path: row.worktree.path }
      const move = (groupId: string): Promise<boolean> =>
        moveZotzConversationToGroup(member, groupId, linkContext)
      return {
        groups: groups.map((group) => ({ id: group.id, name: zotzGroupName(group, unnamed) })),
        currentGroupId: findZotzLinkGroup(groups, member)?.id ?? null,
        onMove: (groupId) => void move(groupId).catch(showError),
        onNewGroup: () => askNewGroup(move),
        onRemove: () => void unlinkZotzConversation(member, linkContext).catch(showError)
      }
    },
    rename: (group) =>
      setRequest({
        groupId: group.id,
        current: group.name ?? '',
        onSave: (name) => renameZotzGroupNamed(group.id, name)
      }),
    remove: (group) => void deleteZotzGroup(group.id, linkContext).catch(showError),
    nameDialog: <ZotzGroupNameDialog request={request} onClose={() => setRequest(null)} />
  }
}

/** The "Groups" part of the sidebar: header with "+", then each group and its conversations. */
export function ZotzSidebarGroups({
  sections,
  ui,
  renderConversation,
  header
}: {
  sections: readonly GroupSection[]
  ui: ZotzSidebarGroupsUi
  renderConversation: (
    row: ConversationRow,
    repo: Repo,
    options: { showHost: boolean; showProject: boolean }
  ) => React.JSX.Element
  header: (label: string, action: React.ReactNode) => React.JSX.Element
}): React.JSX.Element {
  const t = useTranslate()
  const newGroupLabel = t('zotz.groups.new', 'New group')
  return (
    <>
      {header(
        t('zotz.groups.title', 'Groups'),
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              type="button"
              aria-label={newGroupLabel}
              onClick={() => ui.askNewGroup()}
            >
              <Plus className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            {newGroupLabel}
          </TooltipContent>
        </Tooltip>
      )}
      {sections.length === 0 ? (
        <p className="px-2 pb-2 text-xs text-worktree-sidebar-foreground/50">
          {t(
            'zotz.groups.none',
            'Group conversations from several projects to work on one task together.'
          )}
        </p>
      ) : null}
      {sections.map(({ group, conversations }) => {
        const multiHost = new Set(conversations.map((row) => row.hostId)).size > 1
        return (
          <ZotzGroupSection
            key={group.id}
            group={group}
            count={conversations.length}
            onRename={() => ui.rename(group)}
            onDelete={() => ui.remove(group)}
          >
            {conversations.map((row) =>
              row.repo
                ? renderConversation(row, row.repo, { showHost: multiHost, showProject: true })
                : null
            )}
          </ZotzGroupSection>
        )
      })}
    </>
  )
}
