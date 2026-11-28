import { defineFixture } from '../../../component-fixtures/component-fixture'
import { ZotzFlowEditor } from './ZotzFlowEditor'
import { ZOTZ_FLOW_EXAMPLE } from './zotz-flow-example-data'
import { createZotzFlowDraft } from './zotz-flow-new-draft'

const hosts = [
  { id: 'local', label: 'Esta Mac' },
  { id: 'runtime:msi', label: 'MSI' }
]

function render(): React.JSX.Element {
  return (
    <div className="flex h-[760px]">
      <ZotzFlowEditor
        initial={ZOTZ_FLOW_EXAMPLE}
        savedAt={ZOTZ_FLOW_EXAMPLE.updatedAt}
        hosts={hosts}
        flows={[]}
        onSave={async (draft) => ({
          saved: true,
          flow: { ...ZOTZ_FLOW_EXAMPLE, ...draft },
          problems: []
        })}
        onRun={async () => {}}
      />
    </div>
  )
}

function click(frame: HTMLElement, selector: string): Promise<void> {
  frame.querySelector<HTMLElement>(selector)?.click()
  return new Promise((resolve) => setTimeout(resolve, 300))
}

export const example = defineFixture({ width: 1280, render })

export const agentSelected = defineFixture({
  width: 1280,
  render,
  interact: (frame) => click(frame, '.react-flow__node[data-id="n-review"]')
})

export const loopSelected = defineFixture({
  width: 1280,
  render,
  interact: (frame) => click(frame, '.react-flow__node[data-id="n-fix"]')
})

export const empty = defineFixture({
  width: 1280,
  render: () => (
    <div className="flex h-[760px]">
      <ZotzFlowEditor
        initial={createZotzFlowDraft('Revisar PRs', [])}
        savedAt={null}
        hosts={hosts}
        flows={[]}
        onSave={async (draft) => ({
          saved: true,
          flow: { ...draft, createdAt: 0, updatedAt: 1 },
          problems: []
        })}
        onRun={async () => {}}
      />
    </div>
  )
})
