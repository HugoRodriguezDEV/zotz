import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Link2, Link2Off, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/store/index'
import { useTranslate } from '@/i18n/use-translate'
import { activateAndRevealWorkspace } from '@/lib/workspace/activation/worktree-activation'
import type {
  ZotzConversationEntry,
  ZotzLinkGroup
} from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import {
  useZotzLinkConversations,
  useZotzLinkHosts,
  useZotzLinkMessages,
  type ZotzLinkHost
} from './use-zotz-link-data'
import {
  linkZotzConversations,
  unlinkZotzConversation,
  type ZotzLinkContext
} from './zotz-link-actions'
import {
  canZotzLinkTogether,
  findZotzLinkGroup,
  sameZotzLinkMember,
  type ZotzLinkMember
} from './zotz-link-groups'
import { findZotzLinkWorktreeId, selectActiveZotzLinkMember } from './zotz-link-worktrees'
import { ZotzLinkConversationRow } from './ZotzLinkConversationRow'
import { ZotzLinkTimeline } from './ZotzLinkTimeline'

const NO_GROUPS: readonly ZotzLinkGroup[] = []

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="space-y-1">
      <h3 className="px-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

/** Right sidebar tab: link conversations with a click and watch the group work together. */
export default function ZotzLinksPanel(): React.JSX.Element {
  const t = useTranslate()
  const hosts = useZotzLinkHosts()
  const conversations = useZotzLinkConversations(hosts, true)
  const groups = useAppStore((s) => s.settings?.zotzConversationLinks) ?? NO_GROUPS
  const active = useAppStore(useShallow(selectActiveZotzLinkMember))
  const [busy, setBusy] = useState(false)

  const entryFor = (member: ZotzLinkMember): ZotzConversationEntry | null => {
    const list = conversations.get(member.hostId)
    return list?.status === 'ready'
      ? (list.conversations.find((entry) => entry.path === member.path) ?? null)
      : null
  }
  const hostFor = (hostId: string): ZotzLinkHost | undefined =>
    hosts.find((host) => host.hostId === hostId)
  const context: ZotzLinkContext = { hosts, entryFor }
  const group = active ? findZotzLinkGroup(groups, active) : null
  const partners = group?.members.filter((m) => !active || !sameZotzLinkMember(m, active)) ?? []
  // One string so polling restarts only when the group's addresses really change.
  const addressKey = (group?.members ?? [])
    .flatMap((member) => {
      const address = entryFor(member)?.address
      return address ? [address] : []
    })
    .join('\n')
  const messages = useZotzLinkMessages(hosts, addressKey, group !== null)

  const nameFor = (addressOrLabel: string): string => {
    for (const member of group?.members ?? []) {
      const entry = entryFor(member)
      if (entry?.address && addressOrLabel.includes(entry.address)) {
        return entry.shortName
      }
    }
    return addressOrLabel
  }
  const open = (member: ZotzLinkMember): void => {
    const id = findZotzLinkWorktreeId(useAppStore.getState(), member)
    if (id) {
      activateAndRevealWorkspace(id)
    }
  }
  const run = (work: () => Promise<void>): void => {
    setBusy(true)
    void work().finally(() => setBusy(false))
  }
  const machineOf = (member: ZotzLinkMember) =>
    active && member.hostId !== active.hostId
      ? { hostId: member.hostId, name: hostFor(member.hostId)?.name ?? member.hostId }
      : null

  const linkAction = (member: ZotzLinkMember): React.ReactNode => {
    if (!active || sameZotzLinkMember(member, active)) {
      return null
    }
    if (partners.some((p) => sameZotzLinkMember(p, member))) {
      return (
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={busy}
          aria-label={t('zotz.links.unlink', 'Unlink')}
          title={t('zotz.links.unlink', 'Unlink')}
          onClick={() => run(() => unlinkZotzConversation(member, context))}
        >
          <Link2Off className="size-3.5" />
        </Button>
      )
    }
    const allowed = canZotzLinkTogether([...(group?.members ?? [active]), member])
    const button = (
      <Button
        variant="outline"
        size="xs"
        disabled={busy || !allowed}
        onClick={() => run(() => linkZotzConversations(active, member, context))}
      >
        <Link2 className="size-3" />
        {t('zotz.links.link', 'Link')}
      </Button>
    )
    return allowed ? (
      button
    ) : (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{button}</span>
        </TooltipTrigger>
        <TooltipContent side="left">
          {t(
            'zotz.links.twoServers',
            "Two servers can't write to each other. Link each one with a conversation on this machine."
          )}
        </TooltipContent>
      </Tooltip>
    )
  }

  const activeEntry = active ? entryFor(active) : null
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto scrollbar-sleek">
      <div className="flex h-9 shrink-0 items-center gap-1.5 px-3 text-xs font-medium text-muted-foreground">
        <Users className="size-3.5" />
        {t('zotz.links.title', 'Linked conversations')}
      </div>
      <div className="space-y-4 px-1 pb-3">
        {!active ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {t(
              'zotz.links.noActive',
              'Open a conversation to link it with others and see them work together.'
            )}
          </p>
        ) : group ? (
          <>
            <Section title={t('zotz.links.workingTogether', 'Working together')}>
              {group.members.map((member) => {
                const entry = entryFor(member)
                return entry ? (
                  <ZotzLinkConversationRow
                    key={`${member.hostId}:${member.path}`}
                    entry={entry}
                    machine={machineOf(member)}
                    highlighted={sameZotzLinkMember(member, active)}
                    onOpen={() => open(member)}
                    action={linkAction(member)}
                  />
                ) : null
              })}
              {activeEntry ? (
                <div className="px-2">
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={busy}
                    onClick={() => run(() => unlinkZotzConversation(active, context))}
                  >
                    <Link2Off className="size-3" />
                    {t('zotz.links.leave', 'Leave the group')}
                  </Button>
                </div>
              ) : null}
            </Section>
            <Section title={t('zotz.links.messages', 'Messages between them')}>
              <div className="px-1">
                <ZotzLinkTimeline messages={messages} nameFor={nameFor} />
              </div>
            </Section>
          </>
        ) : (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {t(
              'zotz.links.notLinked',
              '{{name}} works alone. Link it with another conversation below; both agents learn how to write to each other.',
              { name: activeEntry?.shortName ?? '' }
            )}
          </p>
        )}
        {hosts.map((host) => {
          const list = conversations.get(host.hostId)
          return (
            <Section key={host.hostId} title={host.name}>
              {!host.supported ? (
                <p className="px-2 text-[11px] text-muted-foreground">
                  {t(
                    'zotz.links.updateServer',
                    'Update Zotz on {{host}} to link its conversations.',
                    {
                      host: host.name
                    }
                  )}
                </p>
              ) : list?.status === 'ready' ? (
                list.conversations.length === 0 ? (
                  <p className="px-2 text-[11px] text-muted-foreground">
                    {t('zotz.links.none', 'No conversations here.')}
                  </p>
                ) : (
                  list.conversations.map((entry) => {
                    const member = { hostId: host.hostId, path: entry.path }
                    return (
                      <ZotzLinkConversationRow
                        key={entry.path}
                        entry={entry}
                        highlighted={active ? sameZotzLinkMember(member, active) : false}
                        onOpen={() => open(member)}
                        action={linkAction(member)}
                      />
                    )
                  })
                )
              ) : (
                <p className="px-2 text-[11px] text-muted-foreground">
                  {list?.status === 'error'
                    ? t('zotz.links.unreachable', "{{host}} isn't answering.", { host: host.name })
                    : t('zotz.links.loading', 'Loading…')}
                </p>
              )}
            </Section>
          )
        })}
      </div>
    </div>
  )
}
