import type React from 'react'
import { ArrowRight } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { formatRelativeTime } from '@/components/activity/activity-thread-presentation'
import type { ZotzLinkMessage } from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'

/** The mail a linked group sends each other, oldest first, named by short name. */
export function ZotzLinkTimeline({
  messages,
  nameFor
}: {
  messages: readonly ZotzLinkMessage[]
  /** Short name of the conversation behind an address (or a remote sender label). */
  nameFor: (addressOrLabel: string) => string
}): React.JSX.Element {
  const t = useTranslate()
  if (messages.length === 0) {
    return (
      <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">
        {t(
          'zotz.links.noMessages',
          'No messages between them yet. They write to each other when they need to.'
        )}
      </p>
    )
  }
  return (
    <ol className="space-y-1.5">
      {messages.map((message) => (
        <li key={message.id} className="rounded-md border border-border bg-card px-2 py-1.5">
          <div className="flex min-w-0 items-center gap-1 text-2xs text-muted-foreground">
            <span className="truncate font-medium text-foreground">
              {nameFor(message.fromLabel ?? message.from)}
            </span>
            <ArrowRight className="size-3 shrink-0" />
            <span className="truncate font-medium text-foreground">{nameFor(message.to)}</span>
            <span className="ml-auto shrink-0">{formatRelativeTime(message.createdAt)}</span>
          </div>
          {message.subject ? (
            <div className="mt-0.5 truncate text-xs font-medium text-foreground">
              {message.subject}
            </div>
          ) : null}
          <p className="line-clamp-3 text-[11px] whitespace-pre-wrap text-muted-foreground">
            {message.body}
          </p>
        </li>
      ))}
    </ol>
  )
}
