import { spawnProcess } from '@orca/process-host'
import { windowsPowerShellPath } from '@orca/process-host/windows-system-binary'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import type {
  ZotzSystemBatteryState,
  ZotzSystemPower,
  ZotzSystemProcess
} from '../../../shared/zotz/system-monitor/zotz-system-monitor-contract'
import type { ZotzPlatformTick, ZotzSystemPlatformSampler } from './zotz-system-platform-sampler'

const MIB = 1024 * 1024
const LINE_LIMIT_CHARS = 4 * 1024 * 1024
// Win32_Battery reports this run time while on AC power.
const UNKNOWN_RUN_TIME_MINUTES = 71_582_788
const MAX_STARTS = 3
const VIRTUAL_ADAPTER = /isatap|teredo|loopback|pseudo|6to4/i

/**
 * One PowerShell for as long as someone watches, not one per sample: CIM perf classes keep their
 * English names on localized Windows (typeperf counters do not), and a single long-lived
 * interpreter avoids per-operation spawns. It exits on its own if Zotz goes away.
 */
export function zotzWindowsSamplerScript(parentPid: number, intervalMs: number): string {
  return [
    "$ErrorActionPreference = 'SilentlyContinue'",
    "$ProgressPreference = 'SilentlyContinue'",
    `$parent = ${Math.trunc(parentPid)}`,
    '$i = 0',
    '$gm = (Get-CimInstance Win32_VideoController -Property Name | Select-Object -First 1).Name',
    'while ($true) {',
    'if (-not (Get-Process -Id $parent)) { break };',
    '$o = @{};',
    '$o.net = @(Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface -Property Name,BytesReceivedPersec,BytesSentPersec | ForEach-Object { @{ n = $_.Name; d = [double]$_.BytesReceivedPersec; u = [double]$_.BytesSentPersec } });',
    '$d = Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk -Filter "Name=\'_Total\'" -Property DiskReadBytesPersec,DiskWriteBytesPersec;',
    'if ($d) { $o.disk = @{ r = [double]$d.DiskReadBytesPersec; w = [double]$d.DiskWriteBytesPersec } };',
    '$e = @(Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -Property Name,UtilizationPercentage);',
    "if ($e.Count -gt 0) { $o.gpu = [double](($e | Group-Object { $_.Name -replace '^pid_\\d+_', '' } | ForEach-Object { ($_.Group | Measure-Object UtilizationPercentage -Sum).Sum } | Measure-Object -Maximum).Maximum); $o.gm = $gm };",
    'if ($i % 5 -eq 0) {',
    '$p = @(Get-CimInstance Win32_PageFileUsage -Property AllocatedBaseSize,CurrentUsage);',
    'if ($p.Count -gt 0) { $o.swap = @{ t = [double]($p | Measure-Object AllocatedBaseSize -Sum).Sum; u = [double]($p | Measure-Object CurrentUsage -Sum).Sum } };',
    '$b = Get-CimInstance Win32_Battery -Property EstimatedChargeRemaining,BatteryStatus,EstimatedRunTime | Select-Object -First 1;',
    'if ($b) { $o.bat = @{ p = [double]$b.EstimatedChargeRemaining; s = [int]$b.BatteryStatus; m = [double]$b.EstimatedRunTime } }',
    '};',
    'if ($i % 3 -eq 0) {',
    '$o.procs = @(Get-CimInstance Win32_PerfFormattedData_PerfProc_Process -Property Name,IDProcess,CreatingProcessID,PercentProcessorTime,WorkingSetPrivate | Where-Object { $_.IDProcess -gt 0 } | ForEach-Object { [string]::Join([char]9, @($_.IDProcess, $_.CreatingProcessID, $_.Name, $_.PercentProcessorTime, $_.WorkingSetPrivate)) })',
    '};',
    'try { [Console]::Out.WriteLine((ConvertTo-Json $o -Compress -Depth 4)); [Console]::Out.Flush() } catch { break };',
    '$i++;',
    `Start-Sleep -Milliseconds ${Math.trunc(intervalMs)}`,
    '}'
  ].join('\n')
}

type WindowsSamplerLine = {
  net?: { n?: unknown; d?: unknown; u?: unknown }[]
  disk?: { r?: unknown; w?: unknown }
  gpu?: unknown
  gm?: unknown
  swap?: { t?: unknown; u?: unknown }
  bat?: { p?: unknown; s?: unknown; m?: unknown }
  procs?: unknown[]
}

// Every field is read defensively below, so any object is a usable line.
function isSamplerLine(value: unknown): value is WindowsSamplerLine {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

// Win32_Battery.BatteryStatus: 1 discharging, 2 on AC, 3 full, 6–9 charging.
function batteryState(status: number | null): ZotzSystemBatteryState | null {
  if (status === 1) {
    return 'discharging'
  }
  if (status === 3) {
    return 'charged'
  }
  if (status === 2) {
    return 'not-charging'
  }
  return status !== null && status >= 6 && status <= 9 ? 'charging' : null
}

/** Perf instance names: "chrome#3" for the fourth chrome. */
function processRows(lines: readonly unknown[]): ZotzSystemProcess[] {
  const rows: ZotzSystemProcess[] = []
  for (const line of lines) {
    const fields = typeof line === 'string' ? line.split('\t') : []
    const pid = Number(fields[0])
    const ppid = Number(fields[1])
    if (fields.length < 5 || !Number.isSafeInteger(pid) || pid <= 0) {
      continue
    }
    const name = fields[2].replace(/#\d+$/, '')
    rows.push({
      pid,
      ppid: Number.isSafeInteger(ppid) ? ppid : 0,
      name,
      command: name,
      user: null,
      cpuPercent: Number(fields[3]) || 0,
      memoryBytes: Number(fields[4]) || 0
    })
  }
  return rows
}

/** One JSON line from the sampler script as a tick; processes only when the line carries them. */
export function parseZotzWindowsSamplerLine(line: string): ZotzPlatformTick | null {
  let raw: unknown
  try {
    raw = JSON.parse(line)
  } catch {
    return null
  }
  if (!isSamplerLine(raw)) {
    return null
  }
  const parsed = raw
  const interfaces = (Array.isArray(parsed.net) ? parsed.net : [])
    .map((entry) => ({
      name: typeof entry?.n === 'string' ? entry.n : '',
      downBps: Math.round(finite(entry?.d) ?? 0),
      upBps: Math.round(finite(entry?.u) ?? 0)
    }))
    .filter((entry) => entry.name !== '' && !VIRTUAL_ADAPTER.test(entry.name))
  const network: ZotzPlatformTick['network'] = Array.isArray(parsed.net)
    ? {
        downBps: interfaces.reduce((sum, entry) => sum + entry.downBps, 0),
        upBps: interfaces.reduce((sum, entry) => sum + entry.upBps, 0),
        receivedBytes: null,
        sentBytes: null,
        defaultInterface: null,
        interfaces: interfaces
          .filter((entry) => entry.downBps + entry.upBps > 0)
          .sort((a, b) => b.downBps + b.upBps - (a.downBps + a.upBps))
          .slice(0, 8)
      }
    : null
  const read = finite(parsed.disk?.r)
  const write = finite(parsed.disk?.w)
  const gpu = finite(parsed.gpu)
  const swapTotal = finite(parsed.swap?.t)
  const swapUsed = finite(parsed.swap?.u)
  const percent = finite(parsed.bat?.p)
  const runTime = finite(parsed.bat?.m)
  const state = batteryState(finite(parsed.bat?.s))
  const battery: ZotzSystemPower['battery'] =
    percent === null
      ? null
      : {
          percent: Math.min(100, percent),
          state,
          minutesLeft:
            state === 'discharging' && runTime !== null && runTime < UNKNOWN_RUN_TIME_MINUTES
              ? runTime
              : null
        }
  return {
    network,
    diskIo:
      read === null || write === null
        ? null
        : { readBps: Math.round(read), writeBps: Math.round(write) },
    gpu:
      gpu === null
        ? null
        : { model: typeof parsed.gm === 'string' ? parsed.gm : null, percent: Math.min(100, gpu) },
    battery,
    onBattery: parsed.bat ? state === 'discharging' : null,
    swap:
      swapTotal === null || swapUsed === null
        ? null
        : { totalBytes: swapTotal * MIB, usedBytes: swapUsed * MIB },
    ...(Array.isArray(parsed.procs) ? { processes: processRows(parsed.procs) } : {})
  }
}

const EMPTY_TICK: ZotzPlatformTick = {
  network: null,
  diskIo: null,
  gpu: null,
  battery: null,
  onBattery: null,
  swap: null
}

export function createZotzWindowsSampler(intervalMs: number): ZotzSystemPlatformSampler {
  let child: ChildProcessWithoutNullStreams | null = null
  let latest: ZotzPlatformTick = EMPTY_TICK
  // Battery and swap ride every fifth line; keep them between.
  let slow: Pick<ZotzPlatformTick, 'battery' | 'onBattery' | 'swap'> = EMPTY_TICK
  let processes: ZotzSystemProcess[] | undefined
  let buffer = ''
  // A PowerShell that keeps dying (blocked by policy, say) is not respawned every tick.
  let starts = 0

  function start(): void {
    starts += 1
    const spawned = spawnProcess({
      program: windowsPowerShellPath(),
      args: [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        zotzWindowsSamplerScript(process.pid, intervalMs)
      ],
      stdio: 'pipe'
    })
    child = spawned
    spawned.stdout.setEncoding('utf8')
    spawned.stdout.on('data', (chunk: string) => {
      buffer += chunk
      if (buffer.length > LINE_LIMIT_CHARS) {
        buffer = ''
      }
      let newline = buffer.indexOf('\n')
      while (newline >= 0) {
        const tick = parseZotzWindowsSamplerLine(buffer.slice(0, newline).trim())
        buffer = buffer.slice(newline + 1)
        newline = buffer.indexOf('\n')
        if (!tick) {
          continue
        }
        if (tick.battery || tick.swap) {
          slow = { battery: tick.battery, onBattery: tick.onBattery, swap: tick.swap }
        }
        latest = { ...tick, ...slow }
        if (tick.processes !== undefined) {
          processes = tick.processes ?? undefined
        }
      }
    })
    spawned.stdout.on('error', () => {})
    spawned.stderr.on('data', () => {})
    spawned.stderr.on('error', () => {})
    spawned.stdin.on('error', () => {})
    spawned.on('error', (error) => {
      console.warn('[zotz-system] Windows sampler failed to start', error)
    })
    spawned.on('exit', () => {
      if (child === spawned) {
        child = null
      }
    })
  }

  return {
    async sample({ withProcesses }) {
      if (!child && starts < MAX_STARTS) {
        start()
      }
      const { processes: _ignored, ...tick } = latest
      if (!withProcesses || processes === undefined) {
        return tick
      }
      const fresh = processes
      processes = undefined
      return { ...tick, processes: fresh }
    },
    dispose() {
      child?.kill()
      child = null
      starts = 0
      buffer = ''
      latest = EMPTY_TICK
    }
  }
}
