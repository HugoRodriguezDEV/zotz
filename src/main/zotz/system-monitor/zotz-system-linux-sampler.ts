// Parsers ported from pblobp.os-vitals 1.0.0 (src/parse/linux-net.ts, linux-disk.ts, linux-gpu.ts,
// linux-battery.ts). MIT License, Copyright (c) 2026 Pablo Boff Pigozzo (pblobp).
// https://github.com/stablyai/orca-community-mirror/tree/main/plugins/os-vitals

import { access, readdir } from 'node:fs/promises'
import type { ZotzSwapUsage } from '../memory-governor/zotz-darwin-memory-signals'
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
import { readZotzCommand, readZotzPsProcesses, readZotzTextFile } from './zotz-system-unix-commands'

const SECTOR_BYTES = 512
const KIB = 1024
const DEFAULT_ROUTE_REFRESH_MS = 30_000
const BATTERY_REFRESH_MS = 10_000
const NVIDIA_SMI = '/usr/bin/nvidia-smi'

/** `/proc/net/dev`: received and sent bytes per interface. */
export function parseLinuxNetDev(text: string): ZotzInterfaceCounters[] | null {
  if (!text.includes('|bytes')) {
    return null
  }
  const out: ZotzInterfaceCounters[] = []
  for (const line of text.split('\n')) {
    const match = /^\s*([^\s:]+):\s*(.*)$/.exec(line)
    const values = match?.[2].trim().split(/\s+/) ?? []
    if (!match || values.length < 16 || !values.slice(0, 16).every((v) => /^\d+$/.test(v))) {
      continue
    }
    out.push({ name: match[1], rxBytes: Number(values[0]), txBytes: Number(values[8]) })
  }
  return out
}

/** `/proc/net/route`: the up default route with the lowest metric. */
export function parseLinuxDefaultRoute(text: string): string | null {
  let best: { name: string; metric: number } | null = null
  for (const line of text.split('\n').slice(1)) {
    const fields = line.trim().split(/\s+/)
    if (fields.length < 8) {
      continue
    }
    const [name, destination, , flags, , , metric, mask] = fields
    const up = (Number.parseInt(flags, 16) & 1) === 1
    if (destination !== '00000000' || mask !== '00000000' || !up) {
      continue
    }
    const value = Number(metric)
    if (!best || value < best.metric) {
      best = { name, metric: value }
    }
  }
  return best?.name ?? null
}

/** `/proc/diskstats`: sectors read and written per block device. */
export function parseLinuxDiskstats(text: string): ZotzDiskCounters[] {
  const out: ZotzDiskCounters[] = []
  for (const line of text.split('\n')) {
    const fields = line.trim().split(/\s+/)
    const sectorsRead = Number(fields[5])
    const sectorsWritten = Number(fields[9])
    if (fields.length < 14 || !(sectorsRead >= 0) || !(sectorsWritten >= 0)) {
      continue
    }
    out.push({
      id: fields[2],
      readBytes: sectorsRead * SECTOR_BYTES,
      writeBytes: sectorsWritten * SECTOR_BYTES
    })
  }
  return out
}

export function parseLinuxSwap(meminfo: string): ZotzSwapUsage | null {
  const kib = (label: string): number | null => {
    const value = Number(new RegExp(`^${label}:\\s*(\\d+)\\s+kB$`, 'm').exec(meminfo)?.[1])
    return Number.isFinite(value) ? value * KIB : null
  }
  const total = kib('SwapTotal')
  const free = kib('SwapFree')
  return total === null || free === null
    ? null
    : { totalBytes: total, usedBytes: Math.max(0, total - free) }
}

/** `nvidia-smi --query-gpu=utilization.gpu,name --format=csv,noheader,nounits`. */
export function parseNvidiaSmi(text: string): ZotzSystemGpu | null {
  let best: ZotzSystemGpu | null = null
  for (const line of text.split('\n')) {
    const [use, ...name] = line.split(',').map((part) => part.trim())
    if (!/^\d+(?:\.\d+)?$/.test(use ?? '')) {
      continue
    }
    const percent = Math.max(0, Math.min(100, Number(use)))
    if (!best || percent > best.percent) {
      best = { model: name.join(', ') || null, percent }
    }
  }
  return best
}

const BATTERY_STATES = new Map<string, ZotzSystemBatteryState>([
  ['charging', 'charging'],
  ['discharging', 'discharging'],
  ['full', 'charged'],
  ['not charging', 'not-charging']
])

export function linuxBattery(files: {
  capacity: string | null
  status: string | null
  energyNow: string | null
  energyFull: string | null
  powerNow: string | null
}): ZotzSystemPower['battery'] {
  const number = (text: string | null): number | null => {
    const value = Number((text ?? '').trim())
    return text !== null && text.trim() !== '' && Number.isFinite(value) ? value : null
  }
  const capacity = number(files.capacity)
  if (capacity === null || capacity < 0 || capacity > 100) {
    return null
  }
  const state = BATTERY_STATES.get((files.status ?? '').trim().toLowerCase()) ?? null
  const power = Math.abs(number(files.powerNow) ?? 0)
  const energyNow = number(files.energyNow)
  const energyFull = number(files.energyFull)
  let hours: number | null = null
  if (power > 0 && energyNow !== null) {
    if (state === 'discharging') {
      hours = energyNow / power
    } else if (state === 'charging' && energyFull !== null) {
      hours = (energyFull - energyNow) / power
    }
  }
  return {
    percent: capacity,
    state,
    minutesLeft: hours !== null && hours > 0 ? Math.round(hours * 60) : null
  }
}

export function createZotzLinuxSampler(now: () => number = Date.now): ZotzSystemPlatformSampler {
  let previousNet: { at: number; counters: ZotzInterfaceCounters[] } | null = null
  let previousDisk: { at: number; counters: ZotzDiskCounters[] } | null = null
  let defaultRoute: { at: number; name: string | null } | null = null
  let battery: { at: number; reading: ZotzSystemPower['battery'] } | null = null
  let batteryName: string | null | undefined
  let gpu: { kind: 'nvidia' } | { kind: 'amd'; card: string } | null | undefined
  let gpuSection: ZotzOptionalSection = 'unknown'
  const wholeDevices = new Map<string, boolean>()

  async function isWholeDevice(name: string): Promise<boolean> {
    const known = wholeDevices.get(name)
    if (known !== undefined) {
      return known
    }
    // Partitions and loop devices have no `device` link; counting them would double the drive.
    const found =
      !name.includes('..') &&
      (await access(`/sys/block/${name.replace(/\//g, '!')}/device`).then(
        () => true,
        () => false
      ))
    wholeDevices.set(name, found)
    return found
  }

  async function readNetwork(at: number): Promise<ZotzPlatformTick['network']> {
    const [text, defaultInterface] = await Promise.all([
      readZotzTextFile('/proc/net/dev'),
      defaultRoute && at - defaultRoute.at < DEFAULT_ROUTE_REFRESH_MS
        ? Promise.resolve(defaultRoute.name)
        : readZotzTextFile('/proc/net/route').then((route) => {
            const name = route === null ? null : parseLinuxDefaultRoute(route)
            defaultRoute = { at, name }
            return name
          })
    ])
    const counters = text === null ? null : parseLinuxNetDev(text)
    if (!counters) {
      return null
    }
    const before = previousNet
    previousNet = { at, counters }
    if (!before) {
      return null
    }
    const rates = zotzNetworkRates('linux', before.counters, counters, (at - before.at) / 1000)
    return { ...rates, defaultInterface }
  }

  async function readDisk(at: number): Promise<ZotzPlatformTick['diskIo']> {
    const text = await readZotzTextFile('/proc/diskstats')
    const all = text === null ? [] : parseLinuxDiskstats(text)
    const keep = await Promise.all(all.map((row) => isWholeDevice(row.id)))
    const counters = all.filter((_, index) => keep[index])
    if (counters.length === 0) {
      return null
    }
    const before = previousDisk
    previousDisk = { at, counters }
    return before ? zotzDiskRates(before.counters, counters, (at - before.at) / 1000) : null
  }

  async function probeGpu(): Promise<typeof gpu> {
    const smi = await readZotzCommand(NVIDIA_SMI, [
      '--query-gpu=utilization.gpu,name',
      '--format=csv,noheader,nounits'
    ])
    if (smi !== null && parseNvidiaSmi(smi)) {
      return { kind: 'nvidia' }
    }
    const cards = await readdir('/sys/class/drm').catch((): string[] => [])
    for (const card of cards.filter((name) => /^card\d+$/.test(name)).sort()) {
      const busy = await readZotzTextFile(`/sys/class/drm/${card}/device/gpu_busy_percent`)
      if (busy !== null && /^\d+$/.test(busy.trim())) {
        return { kind: 'amd', card }
      }
    }
    return null
  }

  async function readGpu(): Promise<ZotzSystemGpu | null> {
    if (gpuSection === 'absent') {
      return null
    }
    if (gpu === undefined) {
      gpu = await probeGpu()
      gpuSection = gpu ? 'present' : 'absent'
    }
    if (!gpu) {
      return null
    }
    if (gpu.kind === 'nvidia') {
      const text = await readZotzCommand(NVIDIA_SMI, [
        '--query-gpu=utilization.gpu,name',
        '--format=csv,noheader,nounits'
      ])
      return text === null ? null : parseNvidiaSmi(text)
    }
    const root = `/sys/class/drm/${gpu.card}/device`
    const [busy, name] = await Promise.all([
      readZotzTextFile(`${root}/gpu_busy_percent`),
      readZotzTextFile(`${root}/product_name`)
    ])
    const percent = Number(busy?.trim())
    return busy !== null && Number.isFinite(percent)
      ? { model: name?.trim() || null, percent: Math.max(0, Math.min(100, percent)) }
      : null
  }

  async function readBattery(at: number): Promise<ZotzSystemPower['battery']> {
    if (battery && at - battery.at < BATTERY_REFRESH_MS) {
      return battery.reading
    }
    if (batteryName === undefined) {
      const supplies = await readdir('/sys/class/power_supply').catch((): string[] => [])
      batteryName = supplies.filter((name) => /^BAT\d*$/.test(name)).sort()[0] ?? null
    }
    let reading: ZotzSystemPower['battery'] = null
    if (batteryName) {
      const read = (file: string): Promise<string | null> =>
        readZotzTextFile(`/sys/class/power_supply/${batteryName}/${file}`)
      const [capacity, status, energyNow, energyFull, powerNow] = await Promise.all([
        read('capacity'),
        read('status'),
        read('energy_now'),
        read('energy_full'),
        read('power_now')
      ])
      reading = linuxBattery({ capacity, status, energyNow, energyFull, powerNow })
    }
    battery = { at, reading }
    return reading
  }

  return {
    async sample({ withProcesses }) {
      const at = now()
      const [network, diskIo, gpuReading, batteryReading, meminfo, processes] = await Promise.all([
        readNetwork(at),
        readDisk(at),
        readGpu(),
        readBattery(at),
        readZotzTextFile('/proc/meminfo'),
        withProcesses ? readZotzPsProcesses() : Promise.resolve(undefined)
      ])
      return {
        network,
        diskIo,
        gpu: gpuReading,
        battery: batteryReading,
        onBattery: batteryReading ? batteryReading.state === 'discharging' : null,
        swap: meminfo === null ? null : parseLinuxSwap(meminfo),
        ...(processes === undefined ? {} : { processes })
      }
    },
    dispose() {
      previousNet = null
      previousDisk = null
    }
  }
}
