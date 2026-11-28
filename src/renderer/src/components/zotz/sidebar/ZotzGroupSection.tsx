import React from 'react'
import { Pencil, Trash2 } from 'lucide-react'
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
import { ZotzPixelIcon } from '../pixel-icon/ZotzPixelIcon'

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
      className={cn('mb-2', highlighted && 'bg-primary/10 ring-1 ring-primary')}
      data-zotz-group={group.id}
    >
      <div
        {...dragHandle}
        className="group flex cursor-grab items-center gap-2 px-2 py-1.5 hover:bg-worktree-sidebar-foreground/5 active:cursor-grabbing"
      >
        <span className="flex w-5 shrink-0 justify-center text-worktree-sidebar-foreground">
          <ZotzPixelIcon name="group" />
        </span>
        <span className="min-w-0 flex-1 truncate font-zotz-display text-[17px] font-extrabold text-worktree-sidebar-foreground tracking-normal subpixel-antialiased">
          {name}
        </span>
        <span className="shrink-0 font-zotz-data text-[13px] text-worktree-sidebar-foreground/60">
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
              <ZotzPixelIcon name="more" />
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
