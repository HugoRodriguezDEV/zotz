import type { CpuInfo } from 'node:os'
import type { ZotzSystemStatus } from '../../../shared/zotz/system-monitor/zotz-system-monitor-contract'
import type { ZotzMemoryGovernorState } from '../memory-governor/zotz-memory-governor-service'
import { zotzCpuUsage, type ZotzCpuTimes } from './zotz-system-rates'

const STATUS_INTERVAL_MS = 3_000
// The governor samples on its own while agents run; an idle node gets one sample per window.
const GOVERNOR_STALE_MS = 15_000

export type ZotzSystemStatusDeps = {
  cpus: () => CpuInfo[]
  governorState: () => ZotzMemoryGovernorState | null
  wakeGovernor: () => void
  now: () => number
  publish: (status: ZotzSystemStatus) => void
}

/**
 * The status bar's numbers while a window shows it: CPU from the kernel counters Node already
 * reads (no process spawned) and memory from the governor, never a second memory sampler.
 */
export class ZotzSystemStatusService {
  private readonly watchers = new Set<number>()
  private previousCpu: ZotzCpuTimes[] = []
  private status: ZotzSystemStatus | null = null
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly deps: ZotzSystemStatusDeps) {}

  watch(watcherId: number): ZotzSystemStatus | null {
    this.watchers.add(watcherId)
    if (!this.timer) {
      this.previousCpu = this.readCpu()
      this.refreshGovernor()
      this.schedule()
    }
    return this.status
  }

  unwatch(watcherId: number): void {
    this.watchers.delete(watcherId)
    if (this.watchers.size === 0 && this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  watcherIds(): number[] {
    return [...this.watchers]
  }

  dispose(): void {
    this.watchers.clear()
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private schedule(): void {
    this.timer = setTimeout(() => {
      this.timer = null
      this.tick()
      if (this.watchers.size > 0) {
        this.schedule()
      }
    }, STATUS_INTERVAL_MS)
    this.timer.unref?.()
  }

  private readCpu(): ZotzCpuTimes[] {
    return this.deps.cpus().map(({ times }) => ({ ...times }))
  }

  private refreshGovernor(): void {
    const state = this.deps.governorState()
    if (!state || this.deps.now() - state.sampledAt > GOVERNOR_STALE_MS) {
      this.deps.wakeGovernor()
    }
  }

  private tick(): void {
    const cpuTimes = this.readCpu()
    const cpu = zotzCpuUsage(this.previousCpu, cpuTimes)
    this.previousCpu = cpuTimes
    this.refreshGovernor()
    const state = this.deps.governorState()
    this.status = {
      sampledAt: this.deps.now(),
      cpuPercent: cpu?.total ?? this.status?.cpuPercent ?? null,
      memory: state
        ? {
            totalBytes: state.totalBytes,
            availableBytes: state.availableBytes,
            pressure: state.pressure,
            minFreeBytes: state.limits.minFreeBytes
          }
        : null
    }
    this.deps.publish(this.status)
  }
}
