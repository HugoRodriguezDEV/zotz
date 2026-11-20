import { useAppStore } from '@/store/index'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import type { ZotzTaskRelayStatus } from '../../../../../shared/zotz/tasks/zotz-task-relay-types'
import { ZotzTaskRelaySetting } from './ZotzTaskRelaySetting'

function stubRelay(status: ZotzTaskRelayStatus): void {
  Object.assign(window.api, {
    zotzTaskConnectors: {
      onRelay: () => () => {},
      relayStatus: async () => status,
      relayCheck: async () => ({ ok: true }),
      relaySetToken: async () => true
    }
  })
}

function render(configured: boolean): React.JSX.Element | null {
  const settings = useAppStore.getState().settings
  return settings ? (
    <ZotzTaskRelaySetting
      settings={{
        ...settings,
        zotzTaskRelay: configured
          ? { url: 'https://zotz-relay.vercel.app', enabled: true, hasToken: true }
          : undefined
      }}
      updateSettings={() => {}}
    />
  ) : null
}

export const connect = defineFixture({
  width: 720,
  setup: () => stubRelay({ state: 'off', error: null, checkedAt: null }),
  render: () => render(false)
})

export const live = defineFixture({
  width: 720,
  setup: () =>
    stubRelay({ state: 'live', error: null, checkedAt: Date.parse('2026-11-20T18:42:00') }),
  render: () => render(true)
})

export const failing = defineFixture({
  width: 720,
  setup: () =>
    stubRelay({
      state: 'failing',
      error: 'The relay did not accept the device token',
      checkedAt: Date.parse('2026-11-20T18:42:00')
    }),
  render: () => render(true)
})
