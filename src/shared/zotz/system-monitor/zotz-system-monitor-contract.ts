import type { ZotzMemoryPressure } from '../agent-queue/zotz-memory-pressure'

// docs/zotz/SPEC-monitor-y-remotos.md §A: what the system monitor measures and sends to a window.

export const ZOTZ_SYSTEM_SAMPLE_INTERVAL_MS = 2_000
export const ZOTZ_SYSTEM_HISTORY_MS = 10 * 60_000
/** Processes ride along every few samples; the list is the heaviest read. */
export const ZOTZ_SYSTEM_PROCESS_EVERY_SAMPLES = 3
export const ZOTZ_SYSTEM_PROCESS_LIMIT = 60

/** One point of the history charts; null where the machine gives no reading. */
export type ZotzSystemSample = {
  t: number
  cpuPercent: number
  memoryUsedBytes: number
  swapUsedBytes: number | null
  netDownBps: number | null
  netUpBps: number | null
  diskReadBps: number | null
  diskWriteBps: number | null
  gpuPercent: number | null
  batteryPercent: number | null
}

export type ZotzSystemCpu = {
  model: string | null
  percent: number
  userPercent: number
  systemPercent: number
  /** Busy percent of each logical core, in OS order. */
  cores: number[]
  /** 1, 5 and 15 minute load; null on Windows, which has none. */
  load: [number, number, number] | null
  uptimeSeconds: number
}

/** The memory governor's numbers: used as Activity Monitor counts it, and its pressure and floor. */
export type ZotzSystemMemory = {
  totalBytes: number
  usedBytes: number
  availableBytes: number
  swapUsedBytes: number | null
  swapTotalBytes: number | null
  pressure: ZotzMemoryPressure
  /** The free memory the governor keeps for the system. */
  minFreeBytes: number
}

export type ZotzSystemInterfaceRate = { name: string; downBps: number; upBps: number }

export type ZotzSystemNetwork = {
  downBps: number
  upBps: number
  /** Since boot, over the counted interfaces; null where the OS only reports rates. */
  receivedBytes: number | null
  sentBytes: number | null
  defaultInterface: string | null
  /** Busiest first. */
  interfaces: ZotzSystemInterfaceRate[]
}

export type ZotzSystemVolume = {
  name: string
  mount: string
  totalBytes: number
  availableBytes: number
}

export type ZotzSystemDisk = {
  readBps: number | null
  writeBps: number | null
  startup: ZotzSystemVolume | null
}

export type ZotzSystemGpu = { model: string | null; percent: number }

export type ZotzSystemBatteryState = 'charging' | 'discharging' | 'charged' | 'not-charging'

export type ZotzSystemPower = {
  onBattery: boolean
  battery: {
    percent: number
    state: ZotzSystemBatteryState | null
    minutesLeft: number | null
  } | null
}

export type ZotzSystemProcess = {
  pid: number
  ppid: number
  name: string
  /** Executable path or command as the OS reports it; may equal the name. */
  command: string
  /** Null on Windows, where the sampler does not resolve owners. */
  user: string | null
  /** Percent of one core; can pass 100 across cores. */
  cpuPercent: number
  memoryBytes: number
}

export type ZotzSystemReading = {
  sampledAt: number
  cpu: ZotzSystemCpu
  memory: ZotzSystemMemory
  network: ZotzSystemNetwork | null
  disk: ZotzSystemDisk
  gpu: ZotzSystemGpu | null
  power: ZotzSystemPower
  /** The top half by CPU plus the top half by memory, busiest first; null until the first read. */
  processes: ZotzSystemProcess[] | null
  processesSampledAt: number | null
}

export type ZotzSystemMonitorSnapshot = {
  platform: NodeJS.Platform
  hostname: string
  intervalMs: number
  historyMs: number
  /** Oldest first; gaps mean nobody was watching. */
  history: ZotzSystemSample[]
  latest: ZotzSystemReading | null
}

/** Pushed to watching windows after every sample. */
export type ZotzSystemMonitorUpdate = {
  /** Null on the first read after a pause, which has no baseline to chart. */
  sample: ZotzSystemSample | null
  latest: ZotzSystemReading
}

/** Who a process belongs to, from the trees Zotz already knows (docs/zotz/SPEC-monitor-y-remotos.md §A.3). */
export type ZotzSystemProcessOwner =
  | { kind: 'agent'; agent: string; worktreeId: string | null; paneKey: string }
  /** Zotz itself: its main process, helpers and terminal daemon. */
  | { kind: 'zotz' }
  /** Started by Zotz and no agent owns it: a terminal, a tool. */
  | { kind: 'zotz-child' }

export type ZotzSystemProcessEntry = ZotzSystemProcess & { owner: ZotzSystemProcessOwner | null }

/** Every process at the last read, for the Processes view. */
export type ZotzSystemProcessList = {
  sampledAt: number | null
  processes: ZotzSystemProcessEntry[]
}

export type ZotzSystemProcessCloseRequest = {
  pid: number
  /** The name the list showed; a different process under a reused PID is refused. */
  name: string
  /** SIGKILL on macOS and Linux, `taskkill /F` on Windows; otherwise SIGTERM or a plain `taskkill`. */
  force: boolean
}

export type ZotzSystemProcessCloseResult =
  | { ok: true; exited: boolean }
  | { ok: false; reason: 'gone' | 'changed' | 'protected' | 'not_permitted' | 'failed' }

/** The status bar's `CPU · MEM` (docs/zotz/SPEC-monitor-y-remotos.md §A.4). */
export type ZotzSystemStatus = {
  sampledAt: number
  /** Null until two CPU reads exist. */
  cpuPercent: number | null
  /** The memory governor's last reading, with its pressure and the one floor it keeps free. */
  memory: {
    totalBytes: number
    availableBytes: number
    pressure: ZotzMemoryPressure
    minFreeBytes: number
  } | null
}
