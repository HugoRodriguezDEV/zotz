// Parsers ported from pblobp.os-vitals 1.0.0 (src/parse/netstat.ts, ioreg-disk.ts, ioreg-gpu.ts,
// pmset.ts). MIT License, Copyright (c) 2026 Pablo Boff Pigozzo (pblobp).
// https://github.com/stablyai/orca-community-mirror/tree/main/plugins/os-vitals

import type {
  ZotzSystemBatteryState,
  ZotzSystemGpu,
  ZotzSystemPower
} from '../../../shared/zotz/system-monitor/zotz-system-monitor-contract'
import type {
  ZotzOptionalSection,
  ZotzPlatformTick,
  ZotzSystemPlatformSampler
} from './zotz-system-platform-sampler'
import {
  zotzDiskRates,
  zotzNetworkRates,
  type ZotzDiskCounters,
  type ZotzInterfaceCounters
} from './zotz-system-rates'
import { readZotzCommand, readZotzPsProcesses } from './zotz-system-unix-commands'

const IOREG_MAX_BUFFER = 8 * 1024 * 1024
const DEFAULT_ROUTE_REFRESH_MS = 30_000
const BATTERY_REFRESH_MS = 10_000

/** `netstat -ibn`: byte counters per interface, read off its link rows. */
export function parseDarwinNetstat(text: string): ZotzInterfaceCounters[] | null {
  const lines = text.split('\n')
  const header = (lines[0] ?? '').trim().split(/\s+/)
  const fromRight = (column: string): number => {
    const index = header.indexOf(column)
    return index === -1 ? -1 : header.length - 1 - index
  }
  const rxOffset = fromRight('Ibytes')
  const txOffset = fromRight('Obytes')
  if (header[0] !== 'Name' || rxOffset < 0 || txOffset < 0) {
    return null
  }
  const seen = new Map<string, ZotzInterfaceCounters>()
  for (const line of lines.slice(1)) {
    const tokens = line.trim().split(/\s+/)
    if (tokens.length < header.length - 1 || !/^<Link#\d+>$/.test(tokens[2] ?? '')) {
      continue
    }
    const rx = tokens[tokens.length - 1 - rxOffset]
    const tx = tokens[tokens.length - 1 - txOffset]
    const name = tokens[0].replace(/\*$/, '')
    if (!/^\d+$/.test(rx ?? '') || !/^\d+$/.test(tx ?? '') || name === '' || seen.has(name)) {
      continue
    }
    seen.set(name, { name, rxBytes: Number(rx), txBytes: Number(tx) })
  }
  return [...seen.values()]
}

function parseIoregDictionary(body: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const match of body.matchAll(/"([^"]+)"=(\d+)/g)) {
    out.set(match[1], Number(match[2]))
  }
  return out
}

/** `ioreg -c IOBlockStorageDriver`: read/write bytes per physical drive, skipping disk images. */
export function parseDarwinDiskDrivers(text: string): ZotzDiskCounters[] {
  const out: ZotzDiskCounters[] = []
  let block: { id: string; lines: string[] } | null = null
  const close = (): void => {
    if (!block) {
      return
    }
    let stats: Map<string, number> | null = null
    let image = false
    for (const line of block.lines) {
      const found = /"Statistics" = \{(.*)\}/.exec(line)
      if (found && !stats) {
        stats = parseIoregDictionary(found[1])
      }
      const media = /\+-o (.+?)\s+<class IOMedia,/.exec(line)
      if (media && /disk image/i.test(media[1])) {
        image = true
      }
    }
    const readBytes = stats?.get('Bytes (Read)')
    const writeBytes = stats?.get('Bytes (Write)')
    if (!image && readBytes !== undefined && writeBytes !== undefined) {
      out.push({ id: block.id, readBytes, writeBytes })
    }
  }
  for (const line of text.split('\n')) {
    const start =
      /^\+-o IOBlockStorageDriver\s+<class IOBlockStorageDriver, id (0x[0-9a-f]+)/i.exec(line)
    if (start) {
      close()
      block = { id: start[1].toLowerCase(), lines: [] }
    } else {
      block?.lines.push(line)
    }
  }
  close()
  return out
}

/** `ioreg -c IOAccelerator`: the busiest GPU's device utilization. */
export function parseDarwinGpu(text: string): ZotzSystemGpu | null {
  const blocks: string[][] = []
  for (const line of text.split('\n')) {
    if (/^\+-o \S/.test(line)) {
      blocks.push([])
    } else {
      blocks.at(-1)?.push(line)
    }
  }
  let best: ZotzSystemGpu | null = null
  for (const block of blocks) {
    let utilization: number | undefined
    let model: string | null = null
    for (const line of block) {
      const stats = /"PerformanceStatistics" = \{(.*)\}/.exec(line)
      if (stats && utilization === undefined) {
        utilization = parseIoregDictionary(stats[1]).get('Device Utilization %')
      }
      const named = /"model" = <?"([^"]*)">?/.exec(line)
      if (named && model === null) {
        model = named[1].trim() || null
      }
    }
    if (utilization !== undefined && Number.isFinite(utilization)) {
      const percent = Math.max(0, Math.min(100, utilization))
      if (!best || percent > best.percent) {
        best = { model, percent }
      }
    }
  }
  return best
}

const BATTERY_STATES: Record<string, ZotzSystemBatteryState> = {
  charging: 'charging',
  discharging: 'discharging',
  charged: 'charged',
  'finishing charge': 'charging'
}

/** `pmset -g batt`; null on a Mac without a battery. */
export function parseDarwinBattery(text: string): {
  onBattery: boolean
  battery: ZotzSystemPower['battery']
} {
  const onBattery = /^Now drawing from '([^']*Battery[^']*)'/im.test(text)
  const line =
    /^\s*-\S*Battery\S*.*?\t\s*(\d{1,3})%;\s*([^;]+?)(?:;\s*([^;]*?))?(?:\s+present:.*)?$/m.exec(
      text
    )
  const percent = Number(line?.[1])
  if (!line || !(percent >= 0 && percent <= 100)) {
    return { onBattery, battery: null }
  }
  const status = line[2].trim().toLowerCase()
  const detail = (line[3] ?? '').trim().toLowerCase()
  const state: ZotzSystemBatteryState | null =
    status === 'ac attached'
      ? detail.startsWith('charging')
        ? 'charging'
        : 'not-charging'
      : (BATTERY_STATES[status] ?? null)
  const remaining = /^(\d+):(\d{2}) remaining/.exec(detail)
  const minutes = remaining ? Number(remaining[1]) * 60 + Number(remaining[2]) : null
  return {
    onBattery,
    battery: {
      percent,
      state,
      minutesLeft:
        minutes !== null && minutes > 0 && (state === 'discharging' || state === 'charging')
          ? minutes
          : null
    }
  }
}

export function createZotzDarwinSampler(now: () => number = Date.now): ZotzSystemPlatformSampler {
  let previousNet: { at: number; counters: ZotzInterfaceCounters[] } | null = null
  let previousDisk: { at: number; counters: ZotzDiskCounters[] } | null = null
  let defaultRoute: { at: number; name: string | null } | null = null
  let battery: { at: number; reading: ReturnType<typeof parseDarwinBattery> } | null = null
  let gpuSection: ZotzOptionalSection = 'unknown'

  async function readDefaultInterface(at: number): Promise<string | null> {
    if (defaultRoute && at - defaultRoute.at < DEFAULT_ROUTE_REFRESH_MS) {
      return defaultRoute.name
    }
    const text = await readZotzCommand('/sbin/route', ['-n', 'get', 'default'])
    const name = text === null ? null : (/^\s*interface:\s*(\S+)\s*$/m.exec(text)?.[1] ?? null)
    defaultRoute = { at, name }
    return name
  }

  async function readNetwork(at: number): Promise<ZotzPlatformTick['network']> {
    const [text, defaultInterface] = await Promise.all([
      readZotzCommand('/usr/sbin/netstat', ['-ibn']),
      readDefaultInterface(at)
    ])
    const counters = text === null ? null : parseDarwinNetstat(text)
    if (!counters || counters.length === 0) {
      return null
    }
    const before = previousNet
    previousNet = { at, counters }
    if (!before) {
      return null
    }
    const rates = zotzNetworkRates('darwin', before.counters, counters, (at - before.at) / 1000)
    return { ...rates, defaultInterface }
  }

  async function readDisk(at: number): Promise<ZotzPlatformTick['diskIo']> {
    const text = await readZotzCommand(
      '/usr/sbin/ioreg',
      ['-r', '-d', '2', '-w', '0', '-c', 'IOBlockStorageDriver'],
      IOREG_MAX_BUFFER
    )
    const counters = text === null ? [] : parseDarwinDiskDrivers(text)
    if (counters.length === 0) {
      return null
    }
    const before = previousDisk
    previousDisk = { at, counters }
    return before ? zotzDiskRates(before.counters, counters, (at - before.at) / 1000) : null
  }

  async function readGpu(): Promise<ZotzSystemGpu | null> {
    if (gpuSection === 'absent') {
      return null
    }
    const text = await readZotzCommand(
      '/usr/sbin/ioreg',
      ['-r', '-d', '1', '-w', '0', '-c', 'IOAccelerator'],
      IOREG_MAX_BUFFER
    )
    const reading = text === null ? null : parseDarwinGpu(text)
    if (gpuSection === 'unknown') {
      gpuSection = reading ? 'present' : 'absent'
    }
    return reading
  }

  async function readBattery(at: number): Promise<ReturnType<typeof parseDarwinBattery>> {
    if (battery && at - battery.at < BATTERY_REFRESH_MS) {
      return battery.reading
    }
    const text = await readZotzCommand('/usr/bin/pmset', ['-g', 'batt'])
    const reading = text === null ? { onBattery: false, battery: null } : parseDarwinBattery(text)
    battery = { at, reading }
    return reading
  }

  return {
    async sample({ withProcesses }) {
      const at = now()
      const [network, diskIo, gpu, power, processes] = await Promise.all([
        readNetwork(at),
        readDisk(at),
        readGpu(),
        readBattery(at),
        withProcesses ? readZotzPsProcesses() : Promise.resolve(undefined)
      ])
      return {
        network,
        diskIo,
        gpu,
        battery: power.battery,
        onBattery: power.onBattery,
        swap: null,
        ...(processes === undefined ? {} : { processes })
      }
    },
    dispose() {
      // Counters left over a pause would average the gap into the first rate back.
      previousNet = null
      previousDisk = null
    }
  }
}
