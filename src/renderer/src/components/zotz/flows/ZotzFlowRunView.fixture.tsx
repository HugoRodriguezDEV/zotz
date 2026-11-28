import { defineFixture } from '../../../component-fixtures/component-fixture'
import { ZotzFlowRunView } from './ZotzFlowRunView'
import { ZOTZ_FLOW_EXAMPLE, ZOTZ_FLOW_EXAMPLE_RUN } from './zotz-flow-example-data'

function openPanels(): void {
  window.localStorage.removeItem('zotz.flows.panel.inspector')
}

const actions = { approve: async () => {}, cancel: async () => {}, retry: async () => {} }

function render(): React.JSX.Element {
  return (
    <div className="flex h-[720px]">
      <ZotzFlowRunView
        flow={ZOTZ_FLOW_EXAMPLE}
        run={ZOTZ_FLOW_EXAMPLE_RUN}
        actions={actions}
        onBack={() => {}}
      />
    </div>
  )
}

export const halfway = defineFixture({ width: 1280, setup: openPanels, render })

export const failedItem = defineFixture({
  width: 1280,
  setup: openPanels,
  render,
  interact: async (frame) => {
    const button = [...frame.querySelectorAll('button')].find(
      (item) => item.textContent?.includes('failed') || item.textContent?.includes('falló')
    )
    button?.click()
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
})
