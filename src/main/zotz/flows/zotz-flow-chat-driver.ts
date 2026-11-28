import { isTuiAgent } from '../../../shared/agent-launch/catalog/tui-agent-config'
import {
  structuredAgentSessionMessageSendMutation,
  structuredAgentSessionSendBody
} from '../../../shared/agent-session/requests/structured-agent-session-send-mutation'
import type { ZotzFlowAgentSessionLink } from '../../../shared/zotz/flows/zotz-flow-run-contract'
import { AUTOMATION_AGENT_CALLER } from '../../automations/launch/automation-run-operation'
import { getStructuredAgentSessionHost } from '../../native-chat/agent-session-wire/host/structured-agent-session-registry'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { rpcCallerOperationKey } from '../../runtime/rpc/callers/rpc-caller-identity'
import {
  ZotzFlowStepError,
  type ZotzFlowAgentDriver,
  type ZotzFlowChatDriver
} from './zotz-flow-executor-types'

const ELSEWHERE =
  'The chat that fired this flow is not on the machine that runs it. Move the flow to that machine to reply there.'

/** Talks to the chat that fired a run, through this machine's chat host (spec §6). */
export function createZotzFlowChatDriver(input: {
  runtime: Pick<
    OrcaRuntimeService,
    'openAgentSessionRecordStore' | 'ensureStructuredAgentSessionHost'
  >
  agents: Pick<ZotzFlowAgentDriver, 'followUp'>
}): ZotzFlowChatDriver {
  const conversation = async (sessionId: string) => {
    const store = await input.runtime.openAgentSessionRecordStore()
    const current = store.getConversation(sessionId)
    if (!current) {
      throw new ZotzFlowStepError(ELSEWHERE, 'chat_elsewhere')
    }
    return current
  }
  return {
    prompt: async ({ node, sessionId, prompt, turn, signal }) => {
      const current = await conversation(sessionId)
      if (!isTuiAgent(current.provider)) {
        throw new ZotzFlowStepError('This chat cannot take prompts from a flow.', 'chat_agent')
      }
      const link: ZotzFlowAgentSessionLink = {
        agentId: current.provider,
        sessionKind: 'chat',
        workspaceId: current.location.workspaceId,
        chatSessionId: sessionId,
        terminalSessionId: null,
        terminalPaneKey: null,
        terminalPtyId: null
      }
      // The chat's own agent answers, whatever agent the step names.
      return input.agents.followUp({
        node: { ...node, agentId: current.provider },
        link,
        prompt,
        turn,
        signal
      })
    },
    send: async ({ sessionId, text, operationId }) => {
      const current = await conversation(sessionId)
      await input.runtime.ensureStructuredAgentSessionHost()
      const host = getStructuredAgentSessionHost()
      if (!host) {
        throw new ZotzFlowStepError('The chat host is not running.', 'chat_host')
      }
      // A stable operation id: a step resumed after a restart never sends twice.
      const sent = await host.send(
        { callerKey: rpcCallerOperationKey(AUTOMATION_AGENT_CALLER) },
        structuredAgentSessionMessageSendMutation({
          sessionId,
          clientOperationId: operationId,
          expectedRuntimeFence: current.currentFence,
          delivery: 'queue-if-active',
          body: structuredAgentSessionSendBody(text, [])
        })
      )
      if (!sent.ok) {
        throw new ZotzFlowStepError(
          `The chat did not take the message (${sent.refusal.code}).`,
          'chat_send_refused'
        )
      }
    }
  }
}
