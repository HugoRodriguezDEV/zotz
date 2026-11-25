import { describe, expect, it, vi } from 'vitest'
import type { CpuInfo } from 'node:os'
import type { HostMemory } from '../../../shared/diagnostics/process-stats-types'
import { computeZotzMemoryGovernorDefaults } from '../../../shared/zotz/agent-queue/zotz-memory-governor-defaults'
import { ZotzSystemMonitorService } from './zotz-system-monitor-service'
import type { ZotzSystemPlatformSampler } from './zotz-system-platform-sampler'

const HOST: HostMemory = {
  totalMemory: 16,
  freeMemory: 8,
  availableMemory: 8,
  availableMemorySource: 'free-memory',
  usedMemory: 8,
  memoryUsagePercent: 50,
  cpuCoreCount: 1,
  loadAverage1m: 0
}

function cpu(busy: number): CpuInfo[] {
  return [{ model: 'x', speed: 1, times: { user: busy, nice: 0, sys: 0, idle: 100, irq: 0 } }]
}

describe('ZotzSystemMonitorService', () => {
  it('samples again when a window re-watches while the previous tick is still running', async () => {
    let releaseFirst: () => void = () => {}
    const firstHost = new Promise<HostMemory>((resolve) => {
      releaseFirst = () => resolve(HOST)
    })
    const collectHost = vi.fn().mockReturnValueOnce(firstHost).mockResolvedValue(HOST)
    const sampler: ZotzSystemPlatformSampler = {
      sample: async () => ({
        network: null,
        diskIo: null,
        gpu: null,
        battery: null,
        onBattery: false,
        swap: null
      }),
      dispose: () => {}
    }
    const publish = vi.fn()
    let busy = 0
    const service = new ZotzSystemMonitorService({
      platform: 'linux',
      hostname: 'test',
      createPlatformSampler: () => ({ ...sampler }),
      collectHost,
      readMemorySignals: async () => ({ pressure: 'ok', swap: null }),
      limits: () => computeZotzMemoryGovernorDefaults(16),
      readStartupVolume: async () => null,
      isOnBatteryPower: () => false,
      cpus: () => cpu((busy += 50)),
      loadavg: () => [0, 0, 0],
      uptime: () => 1,
      now: () => 1_000,
      publish,
      ownersOf: (processes) => processes.map((row) => ({ ...row, owner: null }))
    })

    // React's dev double mount: watch, unwatch, watch while the first read is in flight.
    service.watch(1)
    service.unwatch(1)
    service.watch(1)
    releaseFirst()
    // Well under the 2 s interval: only the owed first sample can land in time.
    await vi.waitFor(() => expect(publish).toHaveBeenCalledTimes(1), { timeout: 1_000 })
    service.dispose()
  })
})
