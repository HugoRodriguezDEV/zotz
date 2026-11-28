import { describe, expect, it } from 'vitest'
import { ZotzFlowSchema } from './zotz-flow-contract'
import {
  buildZotzFlowChatContext,
  parseZotzFlowChatDraft,
  zotzFlowChatEntries,
  zotzFlowChatShortcuts,
  type ZotzFlowChatSource
} from './zotz-flow-chat-command'

function chatFlow(slug: string, trigger: Record<string, unknown>, enabled = true) {
  return ZotzFlowSchema.parse({
    id: `id-${slug}`,
    name: slug,
    slug,
    hostId: 'local',
    enabled,
    triggers: [{ id: `t-${slug}`, kind: 'chat_command', ...trigger }],
    nodes: [],
    edges: [],
    createdAt: 1,
    updatedAt: 1
  })
}

const source: ZotzFlowChatSource = {
  text: 'focus on security',
  messages: [
    { role: 'user', text: 'one', at: 1 },
    { role: 'assistant', text: 'two', at: 2 },
    { role: 'user', text: 'three', at: 3 },
    { role: 'assistant', text: 'four', at: 4 },
    { role: 'assistant', text: '', at: 5 }
  ],
  attachments: [{ name: 'a.png', path: '/tmp/a.png' }],
  workspace: { id: 'repo::/w', name: 'w', path: '/w' },
  repo: 'zotz',
  branch: 'main',
  agent: 'claude',
  sessionId: 'chat-1'
}

describe('zotz flow chat command', () => {
  it('reads /flow, /flow <slug> text and a shortcut; anything else is not Zotz’s', () => {
    const shortcuts = new Set(['revisar-pr'])
    expect(parseZotzFlowChatDraft('/flow', shortcuts)).toEqual({ kind: 'menu', text: '' })
    expect(parseZotzFlowChatDraft('/flow Revisar-PR  enfócate\nen seguridad', shortcuts)).toEqual({
      kind: 'slug',
      slug: 'revisar-pr',
      text: 'enfócate\nen seguridad'
    })
    expect(parseZotzFlowChatDraft('/revisar-pr ya', shortcuts)).toEqual({
      kind: 'shortcut',
      name: 'revisar-pr',
      text: 'ya'
    })
    expect(parseZotzFlowChatDraft('/compact', shortcuts)).toBeNull()
    expect(parseZotzFlowChatDraft('hola /flow', shortcuts)).toBeNull()
  })

  it('leaves a shortcut to a same-named agent command or skill, and lists only enabled flows', () => {
    const entries = [
      ...zotzFlowChatEntries('server', [
        chatFlow('review', { command: 'review' }),
        chatFlow('deploy', { command: 'deploy' }),
        chatFlow('off', { command: 'off' }, false)
      ]),
      ...zotzFlowChatEntries('local', [chatFlow('deploy-local', { command: 'deploy' })])
    ]
    expect(entries.map((entry) => entry.flow.slug)).toEqual(['review', 'deploy', 'deploy-local'])
    const shortcuts = zotzFlowChatShortcuts(entries, ['Review', 'my-skill'])
    expect([...shortcuts].map(([name, entry]) => [name, entry.flow.slug])).toEqual([
      ['deploy', 'deploy']
    ])
  })

  it('sends only the context the trigger asks for, with the last N turns', () => {
    const flow = chatFlow('ctx', {
      context: { lastAnswer: true, transcript: true, transcriptMessages: 2, session: false }
    })
    const [entry] = zotzFlowChatEntries('local', [flow])
    expect(buildZotzFlowChatContext(flow, entry.trigger, source)).toEqual({
      text: 'focus on security',
      sessionId: 'chat-1',
      lastAnswer: 'four',
      transcript: [
        { role: 'user', text: 'three', at: 3 },
        { role: 'assistant', text: 'four', at: 4 }
      ]
    })
  })
})
