import { describe, expect, it } from 'vitest'
import { resolveZotzShortNameAddress } from './zotz-short-name-recipient'
import type { ZotzConversationChat } from './zotz-conversation-chat-choice'

function chat(address: string, active = false): ZotzConversationChat {
  return { sessionId: address, address, agent: 'claude', state: 'idle', active, lastFocusedAt: 0 }
}

const conversations = [
  { shortName: 'salmon', chats: [chat('orca_session_id:salmon-1')] },
  {
    shortName: 'tarpon',
    chats: [chat('orca_session_id:tarpon-1'), chat('orca_session_id:tarpon-2', true)]
  },
  {
    shortName: 'albatross',
    chats: [chat('orca_session_id:alba-1'), chat('orca_session_id:alba-2')]
  },
  { shortName: 'rodri', chats: [] }
]

function failure(recipient: string): { code: string; message: string } {
  try {
    resolveZotzShortNameAddress(recipient, conversations)
  } catch (error) {
    return error as { code: string; message: string }
  }
  throw new Error('expected a refusal')
}

describe('resolveZotzShortNameAddress', () => {
  it('names the only open chat', () => {
    expect(resolveZotzShortNameAddress('wt:Salmon', conversations)).toBe('orca_session_id:salmon-1')
  })

  it('picks the chat in the active tab among several', () => {
    expect(resolveZotzShortNameAddress('wt:tarpon', conversations)).toBe('orca_session_id:tarpon-2')
  })

  it('refuses several chats when none is active, listing each', () => {
    const error = failure('wt:albatross')
    expect(error.code).toBe('recipient_ambiguous')
    expect(error.message).toContain('claude orca_session_id:alba-1, claude orca_session_id:alba-2')
  })

  it('refuses a conversation without an open chat', () => {
    expect(failure('wt:rodri')).toMatchObject({
      code: 'recipient_unreachable',
      message: 'rodri has no open conversation. Nothing was sent.'
    })
  })

  it('refuses a name no conversation here has', () => {
    const error = failure('wt:marlin')
    expect(error.code).toBe('recipient_not_found')
    expect(error.message).toContain('No conversation named marlin on this machine')
  })
})
