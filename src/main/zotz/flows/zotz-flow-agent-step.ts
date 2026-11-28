import type { ZotzFlowNodeOf } from '../../../shared/zotz/flows/zotz-flow-node-contract'
import type {
  ZotzFlowAgentSessionLink,
  ZotzFlowNodeOutput
} from '../../../shared/zotz/flows/zotz-flow-run-contract'
import {
  ZotzFlowStepError,
  type ZotzFlowAgentReply,
  type ZotzFlowAgentTurnKey,
  type ZotzFlowStepContext,
  type ZotzFlowStepResult
} from './zotz-flow-executor-types'
import {
  readZotzFlowAgentJson,
  zotzFlowJsonCorrectionPrompt,
  zotzFlowJsonInstruction
} from './zotz-flow-json-output'

type AgentNode = ZotzFlowNodeOf<'agent'>

/** Stable per prompt: the automation receipts it keys survive a restart. */
function turnKey(ctx: ZotzFlowStepContext, suffix: '' | ':fix'): ZotzFlowAgentTurnKey {
  return {
    id: `zotz-flow:${ctx.run.id}:${ctx.node.id}:${ctx.path.join('.')}:${ctx.attempt.attempt}${suffix}`,
    createdAt: ctx.attempt.startedAt
  }
}

/** Stops the agent this step launched when the run is cancelled or the step times out. */
async function untilReply(
  ctx: ZotzFlowStepContext,
  link: ZotzFlowAgentSessionLink,
  reply: Promise<ZotzFlowAgentReply>
): Promise<ZotzFlowAgentReply> {
  const stop = (): void => {
    // The chat that fired the flow is the user's: cancelling the run never closes it.
    if (ctx.node.kind === 'agent' && ctx.node.runInChatSession) {
      return
    }
    void ctx.deps.agents.stop(link).catch((error: unknown) => {
      console.warn('[zotz-flows] could not stop an agent:', error)
    })
  }
  if (ctx.signal.aborted) {
    stop()
    throw ctx.signal.reason
  }
  ctx.signal.addEventListener('abort', stop, { once: true })
  try {
    return await reply
  } finally {
    ctx.signal.removeEventListener('abort', stop)
  }
}

function replyOutput(ctx: ZotzFlowStepContext, reply: ZotzFlowAgentReply): ZotzFlowNodeOutput {
  return {
    markdown: reply.text,
    json: null,
    truncated: reply.truncated,
    capturedAt: ctx.deps.now()
  }
}

/** The chat session id; a step that needs the chat fails when the run did not come from one. */
function chatOf(ctx: ZotzFlowStepContext): NonNullable<ZotzFlowStepContext['run']['chat']> {
  const chat = ctx.run.chat
  if (ctx.run.trigger.kind !== 'chat_command' || !chat) {
    throw new ZotzFlowStepError(
      'This step works only when a chat command fires the flow.',
      'no_chat'
    )
  }
  return chat
}

/** `runInChatSession`: the prompt goes to the chat that fired the flow (spec §6.2). */
async function promptChat(
  ctx: ZotzFlowStepContext,
  node: AgentNode,
  prompt: string
): Promise<ZotzFlowAgentReply> {
  const sessionId = chatOf(ctx).sessionId
  if (!sessionId) {
    throw new ZotzFlowStepError('The chat did not say which conversation it is.', 'no_chat')
  }
  // No memory queue: the chat's agent is already running.
  ctx.markStarted()
  const started = await ctx.deps.chat.prompt({
    node,
    sessionId,
    prompt,
    turn: turnKey(ctx, ''),
    signal: ctx.signal
  })
  ctx.nodeRun.agentSession = started.link
  ctx.changed()
  return untilReply(ctx, started.link, started.reply)
}

async function launch(
  ctx: ZotzFlowStepContext,
  node: AgentNode,
  prompt: string
): Promise<ZotzFlowAgentReply> {
  const { nodeRun, deps } = ctx
  nodeRun.jsonCorrectionRequested = undefined
  if (node.runInChatSession) {
    return promptChat(ctx, node, prompt)
  }
  const workspaceId = node.workspaceSource === 'chat' ? chatWorkspaceId(ctx) : undefined
  nodeRun.status = 'queued'
  nodeRun.queuedAt = deps.now()
  ctx.changed()
  const admitted = await deps.agents.admit({
    agent: node.agentId,
    label: `${ctx.flow.name} · ${node.name}`,
    signal: ctx.signal
  })
  if (!admitted) {
    if (ctx.signal.aborted) {
      throw ctx.signal.reason
    }
    throw new ZotzFlowStepError('The launch was canceled in the agent queue.', 'queue_canceled')
  }
  // Waiting in the queue never counts against the timeout (spec §4.3).
  ctx.markStarted()
  const started = await deps.agents
    .start({
      flow: ctx.flow,
      run: ctx.run,
      node,
      prompt,
      turn: turnKey(ctx, ''),
      signal: ctx.signal,
      workspaceId
    })
    .finally(admitted.release)
  nodeRun.agentSession = started.link
  ctx.changed()
  return untilReply(ctx, started.link, started.reply)
}

function chatWorkspaceId(ctx: ZotzFlowStepContext): string {
  const id = chatOf(ctx).workspace?.id
  if (!id) {
    throw new ZotzFlowStepError('The chat did not say which workspace it is in.', 'no_chat')
  }
  return id
}

/** A step in the chat that fired the flow speaks through that chat's own agent. */
function sessionAgent(node: AgentNode, ctx: ZotzFlowStepContext): AgentNode {
  const link = ctx.nodeRun.agentSession
  return node.runInChatSession && link ? { ...node, agentId: link.agentId } : node
}

function reattach(ctx: ZotzFlowStepContext, node: AgentNode): Promise<ZotzFlowAgentReply> {
  const link = ctx.nodeRun.agentSession
  const pending = link
    ? ctx.deps.agents.reattach({
        node: sessionAgent(node, ctx),
        link,
        turn: turnKey(ctx, ctx.nodeRun.jsonCorrectionRequested ? ':fix' : ''),
        signal: ctx.signal
      })
    : null
  if (!link || !pending) {
    throw new ZotzFlowStepError('Zotz restarted during this step.', 'restarted')
  }
  ctx.markStarted()
  return untilReply(ctx, link, pending)
}

/** Agent step (spec §4.3, §4.4): launch through the automation path, then read Markdown or JSON. */
export async function runZotzFlowAgentStep(
  ctx: ZotzFlowStepContext,
  node: AgentNode
): Promise<ZotzFlowStepResult> {
  const { nodeRun, deps } = ctx
  const userPrompt = ctx.resolve(node.prompt)
  nodeRun.inputs = { prompt: userPrompt }
  const format = node.output
  const prompt =
    format.mode === 'json' ? `${userPrompt}\n${zotzFlowJsonInstruction(format)}` : userPrompt
  const resumed = ctx.resuming && nodeRun.status === 'running'
  let reply = resumed ? await reattach(ctx, node) : await launch(ctx, node, prompt)
  if (format.mode === 'markdown') {
    return { output: replyOutput(ctx, reply) }
  }
  let checked = readZotzFlowAgentJson(reply.text, format)
  if (!checked.ok && !nodeRun.jsonCorrectionRequested && nodeRun.agentSession) {
    // One correction in the same session; a second miss fails the step (spec §4.4).
    nodeRun.jsonCorrectionRequested = true
    nodeRun.output = replyOutput(ctx, reply)
    ctx.changed()
    const fix = await deps.agents.followUp({
      node: sessionAgent(node, ctx),
      link: nodeRun.agentSession,
      prompt: zotzFlowJsonCorrectionPrompt(format, checked.error),
      turn: turnKey(ctx, ':fix'),
      signal: ctx.signal
    })
    nodeRun.agentSession = fix.link
    ctx.changed()
    reply = await untilReply(ctx, fix.link, fix.reply)
    checked = readZotzFlowAgentJson(reply.text, format)
  }
  if (!checked.ok) {
    throw new ZotzFlowStepError(checked.error, 'invalid_json', replyOutput(ctx, reply))
  }
  return { output: { ...replyOutput(ctx, reply), json: checked.value } }
}
