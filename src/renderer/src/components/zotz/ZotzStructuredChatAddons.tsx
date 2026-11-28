import type { NativeChatMessage } from '../../../../shared/native-chat/native-chat-types'
import type { RuntimeClientTarget } from '../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import { ZotzQueuedChatNotice } from './agent-queue/ZotzQueuedChatNotice'
import { ZotzFlowChatSlot } from './flow-chat/ZotzFlowChatSlot'

/** What Zotz adds above a structured chat's composer: its memory-queue wait and its flow plumbing. */
export function ZotzStructuredChatAddons({
  pane,
  worktreeId,
  session
}: {
  pane: { sessionId: string; target: RuntimeClientTarget; agent: string }
  worktreeId: string | null | undefined
  session: { messages: readonly NativeChatMessage[] }
}): React.JSX.Element {
  return (
    <>
      <ZotzQueuedChatNotice sessionId={pane.sessionId} target={pane.target} />
      <ZotzFlowChatSlot
        sessionId={pane.sessionId}
        target={pane.target}
        agent={pane.agent}
        worktreeId={worktreeId ?? null}
        messages={session.messages}
      />
    </>
  )
}
