import { useId, useState } from 'react'
import type React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import type { ZotzHostConversations, ZotzLinkHost } from './use-zotz-link-data'

const TITLE_CLASS = 'text-[11px] font-semibold tracking-wide text-muted-foreground uppercase'
// Question, permission and blocked all wait on the user; only `waiting` reaches the list today.
const NEEDS_YOU: ReadonlySet<string> = new Set(['waiting', 'permission', 'blocked'])

function ZotzLinkHostSummary({
  host,
  list
}: {
  host: ZotzLinkHost
  list: ZotzHostConversations | undefined
}): React.JSX.Element {
  const t = useTranslate()
  if (!host.supported) {
    return <span>{t('zotz.links.hostSummary.outdated', 'Needs an update')}</span>
  }
  if (list?.status === 'error') {
    return <span>{t('zotz.links.hostSummary.unreachable', 'Not answering')}</span>
  }
  if (list?.status !== 'ready') {
    return <span>{t('zotz.links.loading', 'Loading…')}</span>
  }
  const total = list.conversations.length
  if (total === 0) {
    return <span>{t('zotz.links.hostSummary.none', 'No conversations')}</span>
  }
  const working = list.conversations.filter((entry) => entry.state === 'working').length
  const needsYou = list.conversations.filter((entry) => NEEDS_YOU.has(entry.state ?? '')).length
  return (
    <>
      <span>
        {t('zotz.links.hostSummary.conversations', '{{count}} conversations', { count: total })}
      </span>
      {working > 0 ? (
        <span className="text-zotz-working-wave">
          {t('zotz.links.hostSummary.working', '{{count}} working', { count: working })}
        </span>
      ) : null}
      {needsYou > 0 ? (
        <span className="font-semibold text-agent-question">
          {t('zotz.links.hostSummary.needsYou', '{{count}} need you', { count: needsYou })}
        </span>
      ) : null}
    </>
  )
}

/**
 * One machine's conversations. While the open conversation works in a group it folds into a
 * summary row; the user's open/close choice holds until the group changes or the panel closes.
 */
export function ZotzLinkHostSection({
  host,
  list,
  groupKey,
  compact,
  children
}: {
  host: ZotzLinkHost
  list: ZotzHostConversations | undefined
  /** Identity of the open conversation's group; null when it works alone. */
  groupKey: string | null
  compact: boolean
  children: React.ReactNode
}): React.JSX.Element {
  const listId = useId()
  const [choice, setChoice] = useState<{ groupKey: string | null; open: boolean } | null>(null)
  const open = choice && choice.groupKey === groupKey ? choice.open : !compact
  if (!compact) {
    return (
      <section className="space-y-1">
        <h3 className={cn('px-2', TITLE_CLASS)}>{host.name}</h3>
        {children}
      </section>
    )
  }
  return (
    <section className="space-y-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setChoice({ groupKey, open: !open })}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ChevronRight
          aria-hidden
          className={cn(
            'size-3 shrink-0 text-muted-foreground motion-safe:transition-transform',
            open && 'rotate-90'
          )}
        />
        <span className={cn('min-w-0 shrink truncate', TITLE_CLASS)}>{host.name}</span>
        {open ? null : (
          <span className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-2.5 text-2xs text-muted-foreground *:whitespace-nowrap">
            <ZotzLinkHostSummary host={host} list={list} />
          </span>
        )}
      </button>
      <div id={listId} hidden={!open} className="space-y-1">
        {open ? children : null}
      </div>
    </section>
  )
}
