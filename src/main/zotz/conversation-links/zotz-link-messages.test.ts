import { describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../../runtime/orchestration/db/orchestration-db'
import { listZotzLinkMessages } from './zotz-link-messages'

const SALMON = 'orca_session_id:salmon'
const TARPON = 'orca_session_id:tarpon'
const LAPTOP = 'orca_session_id:laptop'
const PARENT_ID = '0b6f6c1e-1d1a-4c55-9a51-6b9a3d4f0a11'
const WORKER_ID = '5d2c7a90-8e3b-4f62-b0d4-2e1f9c8a7b22'
const PARENT = `orca_session_id:${PARENT_ID}`
const WORKER = `orca_session_id:${WORKER_ID}`

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

  it('adds orchestration mail between a parent and its worker, with the brief that started it', () => {
    const db = new OrchestrationDb(':memory:')
    db.db.exec(`
      INSERT INTO runs (id, objective, coordinator_orca_session_id) VALUES ('run_a', 'o', '${PARENT_ID}');
      INSERT INTO tasks (id, run_id, task_title, spec) VALUES ('task_a', 'run_a', 'Paginar', 'Usa cursor');
      INSERT INTO dispatch_contexts (id, run_id, task_id, assignee_handle,
        assignee_orca_session_id, creator_orca_session_id, created_at)
      VALUES ('ctx_a', 'run_a', 'task_a', 'structworker_t', '${WORKER_ID}', '${PARENT_ID}', '2026-01-01 00:00:00');
    `)
    db.insertMessage({ id: 'msg_q', from: 'dispatch:ctx_a', to: 'run:run_a', subject: 'Question' })
    db.insertMessage({ id: 'msg_r', from: 'run:run_a', to: 'dispatch:ctx_a', subject: 'Re' })
    db.insertMessage({ id: 'msg_d', from: 'structworker_t', to: 'run:run_a', subject: 'Done' })
    db.insertMessage({ id: 'msg_x', from: 'structworker_other', to: 'run:run_a', subject: 'x' })

    const { messages } = listZotzLinkMessages(db, { addresses: [PARENT, WORKER] }, null)

    expect(messages.map((message) => [message.id, message.from, message.to])).toEqual([
      ['ctx_a:brief', PARENT, WORKER],
      ['msg_q', WORKER, PARENT],
      ['msg_r', PARENT, WORKER],
      ['msg_d', WORKER, PARENT]
    ])
  })
})
