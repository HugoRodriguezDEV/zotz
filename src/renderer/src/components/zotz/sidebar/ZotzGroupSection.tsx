import React from 'react'
import { Ellipsis, Layers, Pencil, Trash2 } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import type { ZotzLinkGroup } from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'

export function zotzGroupName(group: ZotzLinkGroup, unnamed: string): string {
  return group.name?.trim() || unnamed
}

/** A group's header and its conversations; rows come from the sidebar so they match project rows. */
export function ZotzGroupSection({
  group,
  count,
  dragHandle,
  highlighted,
  onRename,
  onDelete,
  children
}: {
  group: ZotzLinkGroup
  count: number
  /** Drag props for the header, to reorder groups. */
  dragHandle: React.HTMLAttributes<HTMLDivElement>
  /** A conversation is being dragged over it. */
  highlighted: boolean
  onRename: () => void
  onDelete: () => void
  children: React.ReactNode
}): React.JSX.Element {
  const t = useTranslate()
  const name = zotzGroupName(group, t('zotz.groups.unnamed', 'Unnamed group'))
  return (
    <section
      className={cn('mb-2 rounded-md', highlighted && 'bg-primary/10 ring-1 ring-primary')}
      data-zotz-group={group.id}
    >
      <div
        {...dragHandle}
        className="group flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 hover:bg-worktree-sidebar-foreground/5 active:cursor-grabbing"
      >
        <Layers className="size-4 shrink-0 text-worktree-sidebar-foreground/60" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-worktree-sidebar-foreground">
          {name}
        </span>
        <span className="shrink-0 text-xs text-worktree-sidebar-foreground/50 tabular-nums">
          {count}
        </span>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              type="button"
              aria-label={t('zotz.groups.actions', 'Group actions for {{name}}', { name })}
            >
              <Ellipsis className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom">
            <DropdownMenuItem onSelect={onRename}>
              <Pencil className="size-4" />
              {t('zotz.groups.rename', 'Rename group')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 className="size-4" />
              {t('zotz.groups.delete', 'Delete group')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {count === 0 ? (
        <p className="py-1.5 pr-2 pl-8 text-xs text-worktree-sidebar-foreground/50">
          {t('zotz.groups.empty', 'Drag conversations here, or use "Move to group" in their menu.')}
        </p>
      ) : (
        children
      )}
    </section>
  )
}
