import { describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../../runtime/orchestration/db/orchestration-db'
import { listZotzLinkMessages } from './zotz-link-messages'

const SALMON = 'orca_session_id:salmon'
const TARPON = 'orca_session_id:tarpon'
const LAPTOP = 'orca_session_id:laptop'

describe('listZotzLinkMessages', () => {
  it('keeps mail between linked conversations, including mail from another machine, oldest first', () => {
    const db = new OrchestrationDb(':memory:')
    db.insertMessage({ id: 'msg_a', from: SALMON, to: TARPON, subject: 'first', body: 'hi' })
    db.insertMessage({ id: 'msg_b', from: 'term_other', to: TARPON, subject: 'outsider' })
    db.insertMessage({ id: 'msg_c', from: 'zotz', to: SALMON, subject: 'Linked with tarpon' })
    db.insertPeerMailMessage({
      conversationId: 'peerconv_1',
      peerFingerprint: 'fp',
      remoteParty: null,
      message: { id: 'msg_d', from: `${LAPTOP} on Hugo's Mac`, to: SALMON, subject: 'from afar' }
    })
    db.insertMessage({ id: 'msg_e', from: TARPON, to: SALMON, subject: 'Re: first' })

    const { messages } = listZotzLinkMessages(db, { addresses: [SALMON, TARPON, LAPTOP] }, null)

    expect(
      messages.map((message) => [message.id, message.from, message.to, message.fromLabel])
    ).toEqual([
      ['msg_a', SALMON, TARPON, null],
      ['msg_d', LAPTOP, SALMON, `${LAPTOP} on Hugo's Mac`],
      ['msg_e', TARPON, SALMON, null]
    ])
  })
})
