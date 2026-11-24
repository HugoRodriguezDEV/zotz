import type { ZotzSwapUsage } from '../memory-governor/zotz-darwin-memory-signals'
import type {
  ZotzSystemGpu,
  ZotzSystemNetwork,
  ZotzSystemPower,
  ZotzSystemProcess
} from '../../../shared/zotz/system-monitor/zotz-system-monitor-contract'

/** What each OS adds on top of Node's CPU and the governor's memory; null where it has no reading. */
export type ZotzPlatformTick = {
  network: ZotzSystemNetwork | null
  diskIo: { readBps: number; writeBps: number } | null
  gpu: ZotzSystemGpu | null
  battery: ZotzSystemPower['battery']
  /** Null when the OS did not say; the service then asks Electron. */
  onBattery: boolean | null
  /** Left null on macOS, whose swap comes from the governor's signals. */
  swap: ZotzSwapUsage | null
  /** Undefined when not asked for this tick. */
  processes?: ZotzSystemProcess[] | null
}

export type ZotzSystemPlatformSampler = {
  sample(input: { withProcesses: boolean }): Promise<ZotzPlatformTick>
  /** Called when the last window stops watching. */
  dispose(): void
}

/** Something the machine may not have (a GPU, a battery): stop asking after the first miss. */
export type ZotzOptionalSection = 'unknown' | 'present' | 'absent'
