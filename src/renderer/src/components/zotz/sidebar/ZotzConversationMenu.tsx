import React from 'react'
import {
  Archive,
  AtSign,
  Check,
  Copy,
  Layers,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAppStore } from '@/store/index'
import { useTranslate, type Translate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { archiveZotzConversation } from './zotz-archive'
import { runWorktreeDelete } from '../../sidebar/workspace-actions/deletion/delete-worktree-flow'
import type { Worktree } from '../../../../../shared/worktree/types'

/** "Move to group" for a conversation: every group, a new one, and leaving its current one. */
export type ZotzGroupMenu = {
  groups: readonly { id: string; name: string }[]
  currentGroupId: string | null
  onMove: (groupId: string) => void
  onNewGroup: () => void
  onRemove: () => void
}

type MenuParts = {
  Item: typeof DropdownMenuItem | typeof ContextMenuItem
  Separator: typeof DropdownMenuSeparator | typeof ContextMenuSeparator
  Sub: typeof DropdownMenuSub | typeof ContextMenuSub
  SubTrigger: typeof DropdownMenuSubTrigger | typeof ContextMenuSubTrigger
  SubContent: typeof DropdownMenuSubContent | typeof ContextMenuSubContent
}

const DROPDOWN_PARTS: MenuParts = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent
}

const CONTEXT_PARTS: MenuParts = {
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent
}

function GroupSubmenu({
  menu,
  parts: { Item, Separator, Sub, SubTrigger, SubContent }
}: {
  menu: ZotzGroupMenu
  parts: MenuParts
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <Sub>
      <SubTrigger>
        <Layers className="size-4" />
        {t('zotz.groups.moveTo', 'Move to group')}
      </SubTrigger>
      <SubContent>
        {menu.groups.map((group) => (
          <Item
            key={group.id}
            disabled={group.id === menu.currentGroupId}
            onSelect={() => menu.onMove(group.id)}
          >
            {group.id === menu.currentGroupId ? (
              <Check className="size-4" />
            ) : (
              <span className="size-4" />
            )}
            <span className="max-w-56 truncate">{group.name}</span>
          </Item>
        ))}
        {menu.groups.length > 0 ? <Separator /> : null}
        <Item onSelect={menu.onNewGroup}>
          <Plus className="size-4" />
          {t('zotz.groups.newGroupEllipsis', 'New group…')}
        </Item>
        {menu.currentGroupId ? (
          <Item onSelect={menu.onRemove}>
            <LogOut className="size-4" />
            {t('zotz.groups.removeFromGroup', 'Remove from group')}
          </Item>
        ) : null}
      </SubContent>
    </Sub>
  )
}

function MenuItems({
  actions,
  groupMenu,
  parts
}: {
  actions: readonly MenuAction[]
  groupMenu: ZotzGroupMenu | undefined
  parts: MenuParts
}): React.JSX.Element {
  const { Item, Separator } = parts
  // Grouping sits with the conversation's own actions, before archive and delete.
  const split = actions.findIndex((action) => action.separatorBefore)
  const head = split === -1 ? actions : actions.slice(0, split)
  const tail = split === -1 ? [] : actions.slice(split)
  const render = (action: MenuAction): React.JSX.Element => (
    <React.Fragment key={action.key}>
      {action.separatorBefore ? <Separator /> : null}
      <Item variant={action.destructive ? 'destructive' : 'default'} onSelect={action.run}>
        <action.icon className="size-4" />
        {action.label}
      </Item>
    </React.Fragment>
  )
  return (
    <>
      {head.map(render)}
      {groupMenu ? <GroupSubmenu menu={groupMenu} parts={parts} /> : null}
      {tail.map(render)}
    </>
  )
}

type MenuAction = {
  key: string
  label: string
  icon: LucideIcon
  destructive?: boolean
  separatorBefore?: boolean
  run: () => void
}

function conversationActions(
  worktree: Worktree,
  t: Translate,
  onEditShortName: (() => void) | undefined
): MenuAction[] {
  const { openModal } = useAppStore.getState()
  const branch = worktree.branch.replace(/^refs\/heads\//, '')
  const actions: MenuAction[] = [
    {
      key: 'rename',
      label: t('zotz.sidebar.rename', 'Rename'),
      icon: Pencil,
      run: () =>
        openModal('edit-meta', {
          worktreeId: worktree.id,
          repoId: worktree.repoId,
          executionHostId: worktree.hostId,
          currentDisplayName: worktree.displayName,
          currentComment: worktree.comment,
          focus: 'displayName'
        })
    }
  ]
  if (onEditShortName) {
    actions.push({
      key: 'short-name',
      label: t('zotz.sidebar.shortName', 'Short name…'),
      icon: AtSign,
      run: onEditShortName
    })
  }
  if (branch) {
    actions.push({
      key: 'duplicate',
      label: t('zotz.sidebar.duplicate', 'Duplicate in a new worktree'),
      icon: Copy,
      run: () =>
        openModal('new-workspace-composer', {
          initialRepoId: worktree.repoId,
          initialBaseBranch: branch,
          telemetrySource: 'sidebar'
        })
    })
  }
  actions.push({
    key: 'archive',
    label: t('zotz.sidebar.archive', 'Archive'),
    icon: Archive,
    separatorBefore: true,
    run: () => void archiveZotzConversation(worktree)
  })
  // The project's own checkout can be archived but never deleted; only its worktrees can.
  if (!worktree.isMainWorktree) {
    actions.push({
      key: 'delete',
      label: t('zotz.sidebar.delete', 'Delete'),
      icon: Trash2,
      destructive: true,
      run: () =>
        runWorktreeDelete(worktree.id, {
          expectedInstanceId: worktree.instanceId,
          ...(worktree.hostId ? { expectedHostId: worktree.hostId } : {})
        })
    })
  }
  return actions
}

/** Right-click and "…" menu for a conversation row: rename, short name, duplicate, group, archive, delete. */
export function ZotzConversationMenu({
  worktree,
  onEditShortName,
  groupMenu,
  children
}: {
  worktree: Worktree | null
  /** Absent when the machine that owns it cannot keep short names. */
  onEditShortName?: () => void
  groupMenu?: ZotzGroupMenu
  children: React.ReactNode
}): React.JSX.Element {
  const t = useTranslate()
  if (!worktree) {
    return <>{children}</>
  }
  const actions = conversationActions(worktree, t, onEditShortName)
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className="group/conversation relative"
          data-contextual-tour-target="zotz-conversation-row"
        >
          {children}
          <div className="absolute top-1.5 right-1 opacity-0 transition-opacity group-hover/conversation:opacity-100 has-[[data-state=open]]:opacity-100">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  type="button"
                  aria-label={t('zotz.sidebar.conversationActions', 'Conversation actions')}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom">
                <MenuItems actions={actions} groupMenu={groupMenu} parts={DROPDOWN_PARTS} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <MenuItems actions={actions} groupMenu={groupMenu} parts={CONTEXT_PARTS} />
      </ContextMenuContent>
    </ContextMenu>
  )
}
