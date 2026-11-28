import { Loader2, Workflow } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import type { ZotzFlowChatMachineEntry } from './zotz-flow-chat-store'

export type ZotzFlowChatMenuGroup = {
  hostId: string
  /** Shown only when the chat lists flows from more than one machine. */
  label: string
  entries: readonly ZotzFlowChatMachineEntry[]
}

/** `/flow` alone: the flows this chat can fire, grouped by the machine that runs each one. */
export function ZotzFlowChatMenu({
  open,
  groups,
  loading,
  onChoose,
  onClose
}: {
  open: boolean
  groups: readonly ZotzFlowChatMenuGroup[]
  loading: boolean
  onChoose: (entry: ZotzFlowChatMachineEntry) => void
  onClose: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const grouped = groups.length > 1
  const empty = groups.every((group) => group.entries.length === 0)
  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose()
        }
      }}
      title={t('zotz.flowChat.menuTitle', 'Run a flow')}
      description={t(
        'zotz.flowChat.menuDescription',
        'Flows with a chat command trigger, with this chat as their context.'
      )}
    >
      <CommandInput placeholder={t('zotz.flowChat.menuSearch', 'Search flows')} />
      <CommandList>
        {loading && empty ? (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
            {t('zotz.flowChat.menuLoading', 'Reading flows…')}
          </div>
        ) : (
          <CommandEmpty>
            {empty
              ? t(
                  'zotz.flowChat.menuNone',
                  'No flow runs from the chat yet. Add a chat command trigger to a flow in Flows.'
                )
              : t('zotz.flowChat.menuNoMatch', 'No flow matches.')}
          </CommandEmpty>
        )}
        {groups.map((group) =>
          group.entries.length === 0 ? null : (
            <CommandGroup key={group.hostId} heading={grouped ? group.label : undefined}>
              {group.entries.map((entry) => (
                <CommandItem
                  key={`${group.hostId}:${entry.flow.id}`}
                  value={`${group.hostId} ${entry.flow.slug} ${entry.flow.name}`}
                  onSelect={() => onChoose(entry)}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Workflow className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground">{entry.flow.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {`/flow ${entry.flow.slug}`}
                      </div>
                      {entry.flow.description ? (
                        <div className="line-clamp-2 text-xs text-muted-foreground">
                          {entry.flow.description}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )
        )}
      </CommandList>
    </CommandDialog>
  )
}
