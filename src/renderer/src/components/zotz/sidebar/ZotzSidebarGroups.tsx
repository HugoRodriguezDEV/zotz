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
  reorderZotzGroupTo,
  unlinkZotzConversation,
  type ZotzLinkContext
} from '../links/zotz-link-actions'
import { findZotzLinkGroup, sameZotzLinkMember } from '../links/zotz-link-groups'
import { cn } from '@/lib/class-names'
import { getProjectIdentityKey } from '../../../../../shared/project/host-setup/project-host-setup-projection'
import { isBeforeMiddle, useZotzSidebarDrag, type ZotzSidebarDrag } from './use-zotz-sidebar-drag'
import type { ZotzDragItem, ZotzDropAction } from './zotz-sidebar-drop'
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
  drag: ZotzSidebarDrag
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
  const drag = useZotzSidebarDrag((item: ZotzDragItem, action: ZotzDropAction) => {
    const run =
      action.kind === 'reorder-group'
        ? reorderZotzGroupTo(action.groupId, action.index)
        : item.kind !== 'conversation'
          ? Promise.resolve()
          : action.kind === 'move-to-group'
            ? moveZotzConversationToGroup(item.member, action.groupId, linkContext, action.index)
            : action.kind === 'remove-from-group'
              ? unlinkZotzConversation(item.member, linkContext)
              : Promise.resolve()
    void run.catch(showError)
  })
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
    drag,
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

function DropLine({ show }: { show: boolean }): React.JSX.Element | null {
  return show ? <div aria-hidden className="mx-2 my-0.5 h-0.5 rounded-full bg-primary" /> : null
}

/** A conversation row the user can drag; in a group it also takes drops before or after itself. */
export function ZotzDraggableRow({
  drag,
  item,
  dropAt,
  children
}: {
  drag: ZotzSidebarDrag
  item: ZotzDragItem
  /** Member index of this row in its group; absent in a project, whose section takes the drop. */
  dropAt?: { groupId: string; index: number }
  children: React.ReactNode
}): React.JSX.Element {
  const zone = dropAt
    ? drag.zone((event, dragged) =>
        dragged.kind === 'conversation'
          ? {
              kind: 'group',
              groupId: dropAt.groupId,
              index: isBeforeMiddle(event) ? dropAt.index : dropAt.index + 1
            }
          : null
      )
    : {}
  const target = drag.target
  const lineAt =
    dropAt && target?.kind === 'group' && target.groupId === dropAt.groupId ? target.index : null
  const dragging =
    drag.item?.kind === 'conversation' &&
    item.kind === 'conversation' &&
    sameZotzLinkMember(drag.item.member, item.member)
  return (
    <div {...drag.source(item)} {...zone} className={cn(dragging && 'opacity-50')}>
      <DropLine show={dropAt !== undefined && lineAt === dropAt.index} />
      {children}
    </div>
  )
}

/** A project section as a drop target: its own conversations come back out of a group here. */
export function ZotzProjectDropZone({
  drag,
  projectKey,
  children
}: {
  drag: ZotzSidebarDrag
  projectKey: string
  children: React.ReactNode
}): React.JSX.Element {
  const t = useTranslate()
  const hovered = drag.target?.kind === 'project' && drag.target.projectKey === projectKey
  const refused = hovered && drag.action?.kind === 'none' && drag.action.reason === 'other-project'
  const accepts = hovered && drag.action?.kind === 'remove-from-group'
  return (
    <section
      className={cn(
        'mb-2 rounded-md',
        accepts && 'bg-primary/10 ring-1 ring-primary',
        refused && 'ring-1 ring-destructive'
      )}
      {...drag.zone((_event, item) =>
        item.kind === 'conversation' ? { kind: 'project', projectKey } : null
      )}
    >
      {children}
      {refused ? (
        <p className="px-2 pb-1.5 text-xs text-destructive">
          {t('zotz.groups.otherProject', 'A conversation stays in its own project.')}
        </p>
      ) : null}
    </section>
  )
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
      {sections.map(({ group, conversations }, groupIndex) => {
        const multiHost = new Set(conversations.map((row) => row.hostId)).size > 1
        const target = ui.drag.target
        const groupLine =
          target?.kind === 'group-order' && ui.drag.action?.kind === 'reorder-group'
            ? target.index
            : null
        const end = group.members.length
        return (
          <div
            key={group.id}
            {...ui.drag.zone((event, item) =>
              item.kind === 'group'
                ? {
                    kind: 'group-order',
                    index: isBeforeMiddle(event) ? groupIndex : groupIndex + 1
                  }
                : { kind: 'group', groupId: group.id, index: end }
            )}
          >
            <DropLine show={groupLine === groupIndex} />
            <ZotzGroupSection
              group={group}
              count={conversations.length}
              dragHandle={ui.drag.source({ kind: 'group', groupId: group.id, index: groupIndex })}
              highlighted={target?.kind === 'group' && target.groupId === group.id}
              onRename={() => ui.rename(group)}
              onDelete={() => ui.remove(group)}
            >
              {conversations.map((row) => {
                if (!row.repo || !row.worktree) {
                  return null
                }
                const member = { hostId: row.hostId, path: row.worktree.path }
                const index = group.members.findIndex((m) => sameZotzLinkMember(m, member))
                return (
                  <ZotzDraggableRow
                    key={row.id}
                    drag={ui.drag}
                    item={{
                      kind: 'conversation',
                      member,
                      projectKey: getProjectIdentityKey(row.repo),
                      groupId: group.id,
                      index
                    }}
                    dropAt={{ groupId: group.id, index }}
                  >
                    {renderConversation(row, row.repo, { showHost: multiHost, showProject: true })}
                  </ZotzDraggableRow>
                )
              })}
              <DropLine
                show={
                  target?.kind === 'group' &&
                  target.groupId === group.id &&
                  target.index >= end &&
                  ui.drag.action?.kind === 'move-to-group'
                }
              />
            </ZotzGroupSection>
            {groupIndex === sections.length - 1 ? (
              <DropLine show={groupLine === sections.length} />
            ) : null}
          </div>
        )
      })}
    </>
  )
}
