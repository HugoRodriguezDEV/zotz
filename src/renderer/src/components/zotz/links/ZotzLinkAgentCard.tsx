import type React from 'react'
import { useTranslate } from '@/i18n/use-translate'
import type { ZotzConversationEntry } from '../../../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import { ZotzLinkConversationRow } from './ZotzLinkConversationRow'

/** The robot picked in a machine's room: what its row showed, with its link action and group mark. */
export function ZotzLinkAgentCard({
  entry,
  inGroup,
  action,
  onOpen
}: {
  entry: ZotzConversationEntry
  inGroup: boolean
  action: React.ReactNode
  onOpen: () => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <div className="rounded-md border border-border bg-card" aria-live="polite">
      <ZotzLinkConversationRow
        entry={entry}
        onOpen={onOpen}
        action={
          <>
            {inGroup ? (
              <span className="shrink-0 text-2xs text-muted-foreground">
                {t('zotz.links.inGroup', 'In the group')}
              </span>
            ) : null}
            {action}
          </>
        }
      />
    </div>
  )
}
