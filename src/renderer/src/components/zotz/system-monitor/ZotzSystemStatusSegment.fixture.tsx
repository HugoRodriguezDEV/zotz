import type { ZotzSystemStatus } from '../../../../../shared/zotz/system-monitor/zotz-system-monitor-contract'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import { ZotzSystemStatusSegment } from './ZotzSystemStatusSegment'

const GB = 1024 ** 3

function stubStatus(status: ZotzSystemStatus): void {
  window.api.zotzSystemMonitor = {
    watch: async () => null,
    unwatch: async () => {},
    onChanged: () => () => {},
    processes: async () => ({ sampledAt: null, processes: [] }),
    processCommand: async () => null,
    closeProcess: async () => ({ ok: false, reason: 'failed' }),
    watchStatus: async () => status,
    unwatchStatus: async () => {},
    onStatus: () => () => {}
  }
}

function status(availableGb: number, pressure: 'ok' | 'elevated' | 'critical'): ZotzSystemStatus {
  return {
    sampledAt: 0,
    cpuPercent: 37,
    memory: {
      totalBytes: 32 * GB,
      availableBytes: availableGb * GB,
      pressure,
      minFreeBytes: 4.8 * GB
    }
  }
}

function bar(): React.JSX.Element {
  return (
    <div className="flex h-7 items-center justify-end gap-2 border-t border-border bg-sidebar px-2">
      <ZotzSystemStatusSegment iconOnly={false} />
    </div>
  )
}

export const ok = defineFixture({
  width: 420,
  setup: () => stubStatus(status(14, 'ok')),
  render: bar
})

export const elevated = defineFixture({
  width: 420,
  setup: () => stubStatus(status(5.6, 'elevated')),
  render: bar
})

export const critical = defineFixture({
  width: 420,
  setup: () => stubStatus(status(2.1, 'critical')),
  render: bar
})
