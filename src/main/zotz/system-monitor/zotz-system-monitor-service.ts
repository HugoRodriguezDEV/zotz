import type { CpuInfo } from 'node:os'
import type { HostMemory } from '../../../shared/diagnostics/process-stats-types'
import type { ZotzMemoryGovernorLimits } from '../../../shared/zotz/agent-queue/zotz-memory-governor-defaults'
import {
  strongerZotzMemoryPressure,
  zotzMemoryPressure
} from '../../../shared/zotz/agent-queue/zotz-memory-pressure'
import {
  ZOTZ_SYSTEM_HISTORY_MS,
  ZOTZ_SYSTEM_PROCESS_EVERY_SAMPLES,
  ZOTZ_SYSTEM_SAMPLE_INTERVAL_MS,
  type ZotzSystemMonitorSnapshot,
  type ZotzSystemMonitorUpdate,
  type ZotzSystemProcess,
  type ZotzSystemReading,
  type ZotzSystemSample,
  type ZotzSystemVolume
} from '../../../shared/zotz/system-monitor/zotz-system-monitor-contract'
import type { ZotzSystemMemorySignals } from '../memory-governor/zotz-darwin-memory-signals'
import type { ZotzSystemPlatformSampler } from './zotz-system-platform-sampler'
import { zotzCpuUsage, type ZotzCpuTimes } from './zotz-system-rates'

const VOLUME_EVERY_SAMPLES = 15

export type ZotzSystemMonitorDeps = {
  platform: NodeJS.Platform
  hostname: string
  createPlatformSampler: () => ZotzSystemPlatformSampler
  /** The governor's host memory (Activity Monitor's "used" on macOS). */
  collectHost: () => Promise<HostMemory>
  /** The governor's pressure signals; one reader per monitor keeps its own swap window. */
  readMemorySignals: () => Promise<ZotzSystemMemorySignals>
  limits: () => ZotzMemoryGovernorLimits
  readStartupVolume: () => Promise<ZotzSystemVolume | null>
  isOnBatteryPower: () => boolean
  cpus: () => CpuInfo[]
  loadavg: () => number[]
  uptime: () => number
  now: () => number
  publish: (update: ZotzSystemMonitorUpdate) => void
}

/**
 * Samples the machine only while some window watches the System tab; the agent governor keeps
 * its own cadence. History lives in memory and keeps gaps where nobody was watching.
 */
export class ZotzSystemMonitorService {
  private readonly watchers = new Set<number>()
  private history: ZotzSystemSample[] = []
  private latest: ZotzSystemReading | null = null
  private sampler: ZotzSystemPlatformSampler | null = null
  private previousCpu: ZotzCpuTimes[] = []
  private processes: ZotzSystemProcess[] | null = null
  private processesSampledAt: number | null = null
  private volume: ZotzSystemVolume | null = null
  private tick = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private sampling = false

  constructor(private readonly deps: ZotzSystemMonitorDeps) {}

  watch(watcherId: number): ZotzSystemMonitorSnapshot {
    this.watchers.add(watcherId)
    if (!this.sampler) {
      this.sampler = this.deps.createPlatformSampler()
      this.previousCpu = this.readCpuTimes()
      this.tick = 0
      void this.sampleOnce()
    }
    return this.snapshot()
  }

  unwatch(watcherId: number): void {
    this.watchers.delete(watcherId)
    if (this.watchers.size === 0) {
      this.stop()
    }
  }

  isWatching(watcherId: number): boolean {
    return this.watchers.has(watcherId)
  }

  watcherIds(): number[] {
    return [...this.watchers]
  }

  snapshot(): ZotzSystemMonitorSnapshot {
    return {
      platform: this.deps.platform,
      hostname: this.deps.hostname,
      intervalMs: ZOTZ_SYSTEM_SAMPLE_INTERVAL_MS,
      historyMs: ZOTZ_SYSTEM_HISTORY_MS,
      history: this.history,
      latest: this.latest
    }
  }

  dispose(): void {
    this.watchers.clear()
    this.stop()
  }

  private stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.sampler?.dispose()
    this.sampler = null
  }

  private readCpuTimes(): ZotzCpuTimes[] {
    return this.deps.cpus().map(({ times }) => ({ ...times }))
  }

  private async sampleOnce(): Promise<void> {
    const sampler = this.sampler
    if (!sampler || this.sampling) {
      return
    }
    this.sampling = true
    try {
      const withProcesses = this.tick % ZOTZ_SYSTEM_PROCESS_EVERY_SAMPLES === 0
      const [host, signals, platform, volume] = await Promise.all([
        this.deps.collectHost(),
        this.deps.readMemorySignals(),
        sampler.sample({ withProcesses }),
        this.tick % VOLUME_EVERY_SAMPLES === 0
          ? this.deps.readStartupVolume().catch(() => null)
          : Promise.resolve(this.volume)
      ])
      if (this.sampler !== sampler) {
        return
      }
      this.tick += 1
      this.volume = volume
      const now = this.deps.now()
      if (platform.processes !== undefined) {
        this.processes = platform.processes
        this.processesSampledAt = now
      }
      const cpus = this.deps.cpus()
      const cpuTimes = cpus.map(({ times }) => ({ ...times }))
      const cpu = zotzCpuUsage(this.previousCpu, cpuTimes)
      this.previousCpu = cpuTimes
      const limits = this.deps.limits()
      const swap = signals.swap ?? platform.swap
      const load = this.deps.loadavg()
      const reading: ZotzSystemReading = {
        sampledAt: now,
        cpu: {
          model: cpus[0]?.model.trim() || null,
          percent: cpu?.total ?? 0,
          userPercent: cpu?.user ?? 0,
          systemPercent: cpu?.system ?? 0,
          cores: cpu?.cores ?? cpus.map(() => 0),
          load:
            this.deps.platform === 'win32' || load.length < 3
              ? null
              : [load[0] ?? 0, load[1] ?? 0, load[2] ?? 0],
          uptimeSeconds: Math.round(this.deps.uptime())
        },
        memory: {
          totalBytes: host.totalMemory,
          usedBytes: host.usedMemory,
          availableBytes: host.availableMemory,
          swapUsedBytes: swap?.usedBytes ?? null,
          swapTotalBytes: swap?.totalBytes ?? null,
          pressure: strongerZotzMemoryPressure(
            zotzMemoryPressure({
              availableBytes: host.availableMemory,
              totalBytes: host.totalMemory,
              minFreeBytes: limits.minFreeBytes
            }),
            signals.pressure
          ),
          minFreeBytes: limits.minFreeBytes
        },
        network: platform.network,
        disk: {
          readBps: platform.diskIo?.readBps ?? null,
          writeBps: platform.diskIo?.writeBps ?? null,
          startup: volume
        },
        gpu: platform.gpu,
        power: {
          onBattery: platform.onBattery ?? this.deps.isOnBatteryPower(),
          battery: platform.battery
        },
        processes: this.processes,
        processesSampledAt: this.processesSampledAt
      }
      const sample: ZotzSystemSample = {
        t: now,
        cpuPercent: reading.cpu.percent,
        memoryUsedBytes: reading.memory.usedBytes,
        swapUsedBytes: reading.memory.swapUsedBytes,
        netDownBps: reading.network?.downBps ?? null,
        netUpBps: reading.network?.upBps ?? null,
        diskReadBps: reading.disk.readBps,
        diskWriteBps: reading.disk.writeBps,
        gpuPercent: reading.gpu?.percent ?? null,
        batteryPercent: reading.power.battery?.percent ?? null
      }
      // The first sample after a pause has no CPU baseline; it would chart a false zero.
      if (cpu) {
        const oldest = now - ZOTZ_SYSTEM_HISTORY_MS
        this.history = [...this.history.filter((entry) => entry.t >= oldest), sample]
      }
      this.latest = reading
      this.deps.publish({ sample: cpu ? sample : null, latest: reading })
    } catch (error) {
      console.warn('[zotz-system] sample failed', error)
    } finally {
      this.sampling = false
    }
    if (this.sampler === sampler) {
      this.timer = setTimeout(() => {
        this.timer = null
        void this.sampleOnce()
      }, ZOTZ_SYSTEM_SAMPLE_INTERVAL_MS)
      this.timer.unref?.()
    }
  }
}
