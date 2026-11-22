import { createHash } from 'node:crypto'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import type { ZotzLinkPeer } from '../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import { ZOTZ_SHORT_NAME_RECIPIENT_PREFIX } from '../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import { ZOTZ_CLI_COMMAND } from '../../../shared/zotz/zotz-app-identity'

/** Notices come from Zotz itself, not from an agent that could answer them. */
export const ZOTZ_LINK_NOTICE_SENDER = 'zotz'

export type ZotzLinkNoticeRuntime = Pick<
  OrcaRuntimeService,
  'getOrchestrationDb' | 'notifyMessageArrived'
>

let noticeRuntime: ZotzLinkNoticeRuntime | null = null

/** Chat starts happen outside any RPC, so they reach mail through the runtime that owns this host. */
export function registerZotzLinkNoticeRuntime(runtime: ZotzLinkNoticeRuntime): void {
  noticeRuntime = runtime
}

export function getZotzLinkNoticeRuntime(): ZotzLinkNoticeRuntime | null {
  return noticeRuntime
}

const CLI = ZOTZ_CLI_COMMAND
const REPLY = `\`${CLI} orchestration reply --id <message id> --body "<answer>"\``

function oneLine(text: string, max = 80): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

function names(peers: readonly ZotzLinkPeer[]): string {
  const all = peers.map((peer) => peer.shortName)
  return all.length > 1 ? `${all.slice(0, -1).join(', ')} and ${all.at(-1)}` : (all[0] ?? '')
}

function peerLine(peer: ZotzLinkPeer): string {
  const title = oneLine(peer.title)
  const who = `${peer.shortName}${title ? ` ("${title}")` : ''}${peer.machine ? ` on ${peer.machine}` : ''}`
  const to = `--to ${ZOTZ_SHORT_NAME_RECIPIENT_PREFIX}${peer.shortName}`
  if (peer.reach === 'reply-only') {
    return `- ${who} can write to you; answer with ${REPLY}. You can't start mail to it.`
  }
  const on =
    peer.reach === 'on-server' && peer.machine ? ` --on "${peer.machine.replace(/"/g, '\\"')}"` : ''
  return `- ${who}: \`${CLI} orchestration send ${to}${on} --subject "<topic>" --body "<message>"\``
}

/** The status mail that tells an agent who it is linked with and how to write to each. */
export function buildZotzLinkNotice(
  peers: readonly ZotzLinkPeer[],
  previous: readonly ZotzLinkPeer[] = []
): { subject: string; body: string } {
  if (peers.length === 0) {
    return {
      subject: 'Link ended',
      body: `Your link with ${previous.length > 0 ? names(previous) : 'other conversations'} ended. Don't write to them unless the user asks. This notice needs no reply.`
    }
  }
  return {
    subject: `Linked with ${names(peers)}`,
    body: [
      'The user linked this conversation with others so you can work together. Write to them when it helps the work; keep each message short and self-contained.',
      ...peers.map(peerLine),
      `Their mail arrives here as a new turn; answer it with ${REPLY}. Use --on only as shown above. This notice needs no reply.`
    ].join('\n')
  }
}

/** One id per session and link change, so a notice is stored once however often it is asked for. */
export function zotzLinkNoticeId(sessionId: string, changedAt: number): string {
  const digest = createHash('sha256').update(`${sessionId}\0${changedAt}`).digest('hex')
  return `msg_${digest.slice(0, 12)}`
}

/** Leaves the notice in the chat's mailbox; mail must never break a link change or a chat start. */
export function deliverZotzLinkNotice(
  runtime: ZotzLinkNoticeRuntime,
  notice: { id: string; to: string; subject: string; body: string }
): void {
  try {
    const db = runtime.getOrchestrationDb()
    if (db.getMessageById(notice.id)) {
      return
    }
    const message = db.insertMessage({
      id: notice.id,
      from: ZOTZ_LINK_NOTICE_SENDER,
      to: notice.to,
      subject: notice.subject,
      body: notice.body,
      type: 'status'
    })
    runtime.notifyMessageArrived(message.to_handle, message.type)
  } catch (error) {
    console.warn('[zotz] failed to deliver a link notice', { to: notice.to, error })
  }
}
