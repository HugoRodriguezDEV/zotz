import type { Automation } from '../../../shared/automations/automation-definition'
import type { AutomationRun } from '../../../shared/automations/history/automation-run'
import {
  getTuiAgentDetectCommands,
  TUI_AGENT_CONFIG
} from '../../../shared/agent-launch/catalog/tui-agent-config'
import type { ZotzFlowNodeOf } from '../../../shared/zotz/flows/zotz-flow-node-contract'
import type { ZotzFlowAgentSessionLink } from '../../../shared/zotz/flows/zotz-flow-run-contract'
import type { Store } from '../../persistence/loading-store/store'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { launchAutomationChatAgent } from '../../automations/launch/automation-chat-agent-launch'
import { reuseAutomationChat } from '../../automations/launch/automation-chat-session-reuse'
import { launchAutomationTerminalAgent } from '../../automations/launch/automation-terminal-launch'
import { observeAutomationChatRun } from '../../automations/observation/runtime-chat-run-observer'
import { createRuntimeAutomationRunTerminalObserver } from '../../automations/observation/runtime-terminal-run-observer'
import type { AutomationRunCompletionObservation } from '../../automations/observation/run-completion-watcher'
import { resolveAutomationRunTarget } from '../../automations/ownership/run-target-resolution'
import { getStructuredAgentSessionHost } from '../../native-chat/agent-session-wire/host/structured-agent-session-registry'
import { getZotzAgentLaunchQueue } from '../memory-governor/zotz-agent-launch-hold'
import {
  ZotzFlowStepError,
  type ZotzFlowAgentDriver,
  type ZotzFlowAgentReply,
  type ZotzFlowAgentTurn,
  type ZotzFlowAgentTurnKey
} from './zotz-flow-executor-types'
import {
  buildZotzFlowPreviousRuns,
  buildZotzFlowStepAutomation,
  buildZotzFlowTurnRun
} from './zotz-flow-agent-automation'

type AgentNode = ZotzFlowNodeOf<'agent'>

export type ZotzFlowPreviousSession = { link: ZotzFlowAgentSessionLink; turn: ZotzFlowAgentTurnKey }

type LaunchedTarget = {
  workspaceId: string
  sessionKind?: 'terminal' | 'chat'
  chatSessionId?: string | null
  terminalSessionId: string | null
  terminalPaneKey?: string | null
  terminalPtyId?: string | null
}

function linkOf(node: AgentNode, launched: LaunchedTarget): ZotzFlowAgentSessionLink {
  return {
    agentId: node.agentId,
    sessionKind: launched.sessionKind ?? node.surface,
    workspaceId: launched.workspaceId,
    chatSessionId: launched.chatSessionId ?? null,
    terminalSessionId: launched.terminalSessionId,
    terminalPaneKey: launched.terminalPaneKey ?? null,
    terminalPtyId: launched.terminalPtyId ?? null
  }
}

function replyOf(observation: AutomationRunCompletionObservation): ZotzFlowAgentReply {
  if (observation.status !== 'completed') {
    throw new ZotzFlowStepError(
      observation.error ?? 'The agent did not complete this step.',
      observation.errorCode ?? 'agent_failed'
    )
  }
  return {
    text: observation.outputSnapshot?.content ?? '',
    truncated: observation.outputSnapshot?.truncated ?? false
  }
}

/** Agent steps go through the automation launchers and observers (spec §3, §5). */
export function createZotzFlowAgentDriver(input: {
  runtime: OrcaRuntimeService
  store: Store
  allowRemoteHostScheduling: boolean
  /** Sessions this step opened in earlier runs, newest first, for `reuseSession`. */
  previousSessions: (flowId: string, nodeId: string) => ZotzFlowPreviousSession[]
}): ZotzFlowAgentDriver {
  const { runtime, store } = input
  // Which agent each observed terminal turn runs, so a launch refusal is told from output.
  const terminalAgents = new Map<string, AgentNode['agentId']>()
  const terminalObserver = createRuntimeAutomationRunTerminalObserver(runtime, {
    getAgentStatusRowsForPane: (paneKey) => runtime.getAgentStatusRowsForPane(paneKey),
    getAcceptedReply: (paneKey, leadTurnKey) => runtime.getAcceptedAgentReply(paneKey, leadTurnKey),
    subscribeStatusChanges: (listener) => runtime.subscribeAgentStatusRowChanges(listener),
    agentCommandsForRun: (run) => {
      const agent = terminalAgents.get(run.id)
      if (!agent) {
        return []
      }
      const config = TUI_AGENT_CONFIG[agent]
      return [...getTuiAgentDetectCommands(config), config.launchCmd]
    }
  })

  const targetOf = (automation: Automation) => {
    const target = resolveAutomationRunTarget(store, automation, {
      allowRemoteHostScheduling: input.allowRemoteHostScheduling
    })
    if (!target.ok) {
      throw new ZotzFlowStepError(target.error, target.errorCode ?? 'target_unavailable')
    }
    return target
  }

  const observe = (
    node: AgentNode,
    run: AutomationRun,
    signal: AbortSignal
  ): Promise<ZotzFlowAgentReply> | null => {
    if (run.sessionKind === 'chat') {
      return observeAutomationChatRun(runtime, run, signal).then(replyOf)
    }
    const handle = run.terminalPaneKey
      ? runtime.getTerminalHandleForPaneKey(run.terminalPaneKey)
      : null
    if (!handle) {
      return null
    }
    terminalAgents.set(run.id, node.agentId)
    return terminalObserver
      .observeCompletion(handle, { signal, run })
      .then(replyOf)
      .finally(() => terminalAgents.delete(run.id))
  }

  const launch = async (
    automation: Automation,
    node: AgentNode,
    turn: ZotzFlowAgentTurnKey,
    runs: AutomationRun[],
    signal: AbortSignal
  ): Promise<ZotzFlowAgentTurn> => {
    const target = targetOf(automation)
    const run = buildZotzFlowTurnRun(automation, turn, automation.name)
    let launched: LaunchedTarget
    if (node.surface === 'chat') {
      launched = await launchAutomationChatAgent(runtime, {
        automation,
        run,
        target,
        runs,
        unsaved: true
      })
    } else {
      const terminal = await launchAutomationTerminalAgent(runtime, {
        automation,
        run,
        target,
        runs
      })
      const delivered = terminal.delivery ? await terminal.delivery : { error: null }
      if (delivered.error !== null) {
        throw new ZotzFlowStepError(delivered.error, 'prompt_not_delivered')
      }
      launched = terminal
    }
    const link = linkOf(node, launched)
    const reply = observe(
      node,
      buildZotzFlowTurnRun(automation, turn, automation.name, link),
      signal
    )
    if (!reply) {
      throw new ZotzFlowStepError('The agent terminal closed before it answered.', 'agent_lost')
    }
    return { link, reply }
  }

  return {
    admit: async ({ agent, label, signal }) => {
      const queue = getZotzAgentLaunchQueue()
      if (!queue) {
        return { release: () => {} }
      }
      const admission = await queue.admit({
        agent,
        priority: 'automation',
        paneKey: null,
        label,
        signal
      })
      if (admission !== 'admitted' || signal.aborted) {
        return null
      }
      return { release: queue.grantPass(agent) }
    },
    start: ({ flow, node, prompt, turn, signal }) => {
      const automation = buildZotzFlowStepAutomation(flow, node, prompt, node.workspaceId ?? null)
      const runs = buildZotzFlowPreviousRuns(automation, input.previousSessions(flow.id, node.id))
      return launch(automation, node, turn, runs, signal)
    },
    followUp: async ({ node, link, prompt, turn, signal }) => {
      const automation = {
        ...buildZotzFlowStepAutomation(
          { id: 'follow-up', name: node.name },
          node,
          prompt,
          link.workspaceId
        ),
        workspaceMode: 'existing' as const,
        workspaceId: link.workspaceId,
        reuseSession: true
      }
      const previous = buildZotzFlowPreviousRuns(automation, [
        { link, turn: { id: `${turn.id}:previous`, createdAt: turn.createdAt - 1 } }
      ])
      if (link.sessionKind === 'chat') {
        const run = buildZotzFlowTurnRun(automation, turn, automation.name)
        const reused = await reuseAutomationChat(runtime, {
          automation,
          run,
          target: targetOf(automation),
          runs: previous
        })
        if (!reused) {
          throw new ZotzFlowStepError(
            'The agent chat is gone; no correction could be asked.',
            'agent_lost'
          )
        }
        const sent = buildZotzFlowTurnRun(automation, turn, automation.name, linkOf(node, reused))
        return { link: linkOf(node, reused), reply: observe(node, sent, signal)! }
      }
      return launch(automation, node, turn, previous, signal)
    },
    reattach: ({ node, link, turn, signal }) => {
      const automation = buildZotzFlowStepAutomation(
        { id: 'reattach', name: node.name },
        node,
        '',
        link.workspaceId
      )
      return observe(node, buildZotzFlowTurnRun(automation, turn, automation.name, link), signal)
    },
    stop: async (link) => {
      if (link.sessionKind === 'chat' && link.chatSessionId) {
        await getStructuredAgentSessionHost()?.close(link.chatSessionId, 'user-close')
        return
      }
      const handle = link.terminalPaneKey
        ? runtime.getTerminalHandleForPaneKey(link.terminalPaneKey)
        : null
      if (handle) {
        await runtime.closeTerminal(handle)
      }
    }
  }
}
