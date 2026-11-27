import { useEffect, useState } from 'react'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import { ZotzGroupMap, type ZotzGroupMapNode } from './ZotzGroupMap'
import type { ZotzGroupMapEdge, ZotzGroupMapMail } from './zotz-group-map-edges'

const NODES: ZotzGroupMapNode[] = [
  { key: 'panel', label: 'palolo', agent: 'claude', state: 'working', current: true },
  { key: 'api', label: 'barracuda', agent: 'codex', machine: 'MSI', state: 'waiting' },
  { key: 'app', label: 'tautog', agent: 'antigravity', state: 'done' },
  // No agent known: no logo.
  { key: 'child', label: 'marca-pagina', agent: null, state: 'idle' }
]

const EDGES: ZotzGroupMapEdge[] = [
  { a: 0, b: 1, count: 9, lastAt: 3 },
  { a: 0, b: 2, count: 2, lastAt: 2 },
  { a: 1, b: 2, count: 1, lastAt: 1 }
]

// The panel and the API talk a lot; the app checks in now and then; a child hangs off the app.
export const busyGroup = defineFixture({
  width: 340,
  render: () => (
    <div className="p-2">
      <ZotzGroupMap
        groupId={null}
        nodes={NODES}
        edges={EDGES}
        parentEdges={[{ child: 3, parent: 2 }]}
        mail={[]}
        selected={null}
        onSelect={() => {}}
      />
    </div>
  )
})

// Clicking barracuda filters the messages to it: lines away from it fade.
export const agentSelected = defineFixture({
  width: 340,
  render: () => (
    <div className="p-2">
      <ZotzGroupMap
        groupId={null}
        nodes={NODES}
        edges={EDGES}
        parentEdges={[]}
        mail={[]}
        selected="api"
        onSelect={() => {}}
      />
    </div>
  )
})

/** Mail lands after mount, as a poll would deliver it. */
function MailInFlight({
  nodes,
  before,
  after,
  mail
}: {
  nodes: ZotzGroupMapNode[]
  before: ZotzGroupMapEdge[]
  after: ZotzGroupMapEdge[]
  mail: ZotzGroupMapMail[]
}): React.JSX.Element {
  const [arrived, setArrived] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setArrived(true), 50)
    return () => window.clearTimeout(timer)
  }, [])
  return (
    <div className="p-2">
      <ZotzGroupMap
        groupId={null}
        nodes={nodes}
        edges={arrived ? after : before}
        parentEdges={[]}
        mail={arrived ? mail : []}
        selected={null}
        onSelect={() => {}}
      />
    </div>
  )
}

// An envelope halfway from palolo to tautog, who never wrote before: the line grows from palolo.
export const mailInFlight = defineFixture({
  width: 340,
  render: () => (
    <MailInFlight
      nodes={NODES.slice(0, 3)}
      before={[{ a: 0, b: 1, count: 9, lastAt: 3 }]}
      after={[
        { a: 0, b: 1, count: 9, lastAt: 3 },
        { a: 0, b: 2, count: 1, lastAt: 4 }
      ]}
      mail={[{ id: 'm1', from: 0, to: 2, firstOfPair: true }]}
    />
  ),
  interact: () => new Promise((resolve) => window.setTimeout(resolve, 250))
})

// Keyboard: each robot takes focus; arrows moved barracuda down a step.
export const keyboardFocus = defineFixture({
  width: 340,
  render: () => (
    <div className="p-2">
      <ZotzGroupMap
        groupId={null}
        nodes={NODES.slice(0, 3)}
        edges={EDGES}
        parentEdges={[]}
        mail={[]}
        selected={null}
        onSelect={() => {}}
      />
    </div>
  ),
  interact: async (frame) => {
    const button = frame.querySelectorAll('button')[1]
    button?.focus()
    for (let step = 0; step < 3; step++) {
      button?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    }
    await new Promise((resolve) => window.setTimeout(resolve, 300))
  }
})
