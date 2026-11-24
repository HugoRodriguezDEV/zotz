// Ported from pblobp.os-vitals 1.0.0 (src/cpu.ts, src/rates.ts, src/interfaces.ts).
// MIT License, Copyright (c) 2026 Pablo Boff Pigozzo (pblobp).
// https://github.com/stablyai/orca-community-mirror/tree/main/plugins/os-vitals

import type { ZotzSystemInterfaceRate } from '../../../shared/zotz/system-monitor/zotz-system-monitor-contract'

export type ZotzCpuTimes = { user: number; nice: number; sys: number; idle: number; irq: number }

export type ZotzCpuUsage = { total: number; user: number; system: number; cores: number[] }

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function share(part: number, whole: number): number {
  return whole <= 0 ? 0 : round1(Math.min(100, Math.max(0, (part / whole) * 100)))
}

function grew(previous: number, next: number): number {
  const delta = next - previous
  return Number.isFinite(delta) && delta > 0 ? delta : 0
}

/** Busy share between two `os.cpus()` reads; null when the core count changed. */
export function zotzCpuUsage(
  previous: readonly ZotzCpuTimes[],
  next: readonly ZotzCpuTimes[]
): ZotzCpuUsage | null {
  if (previous.length === 0 || previous.length !== next.length) {
    return null
  }
  let userAll = 0
  let systemAll = 0
  let elapsedAll = 0
  const cores: number[] = []
  for (let index = 0; index < next.length; index++) {
    const before = previous[index]
    const after = next[index]
    const user = grew(before.user, after.user) + grew(before.nice, after.nice)
    const system = grew(before.sys, after.sys) + grew(before.irq, after.irq)
    const elapsed = user + system + grew(before.idle, after.idle)
    cores.push(share(user + system, elapsed))
    userAll += user
    systemAll += system
    elapsedAll += elapsed
  }
  if (elapsedAll <= 0) {
    return null
  }
  return {
    total: share(userAll + systemAll, elapsedAll),
    user: share(userAll, elapsedAll),
    system: share(systemAll, elapsedAll),
    cores
  }
}

export type ZotzInterfaceCounters = { name: string; rxBytes: number; txBytes: number }

export type ZotzDiskCounters = { id: string; readBytes: number; writeBytes: number }

const MAC_UNCOUNTED = new Set(['lo', 'bridge', 'utun', 'gif', 'stf', 'awdl', 'llw', 'anpi', 'ap'])
const LINUX_VIRTUAL_PREFIXES = [
  'lo',
  'docker',
  'bridge',
  'br',
  'virbr',
  'veth',
  'tun',
  'tap',
  'wg',
  'gretap',
  'gre',
  'erspan',
  'ip_vti',
  'ip6_vti',
  'ip6tnl',
  'ip6gre',
  'sit'
]

/** Loopback, tunnels, bridges and helper links would double-count traffic in the totals. */
export function zotzInterfaceCounts(platform: NodeJS.Platform, name: string): boolean {
  if (platform === 'linux') {
    return !LINUX_VIRTUAL_PREFIXES.some((prefix) => name.startsWith(prefix))
  }
  return !MAC_UNCOUNTED.has(name.replace(/\d+$/, ''))
}

const INTERFACE_LIMIT = 8

export type ZotzNetworkRates = {
  downBps: number
  upBps: number
  receivedBytes: number
  sentBytes: number
  interfaces: ZotzSystemInterfaceRate[]
}

export function zotzNetworkRates(
  platform: NodeJS.Platform,
  previous: readonly ZotzInterfaceCounters[],
  current: readonly ZotzInterfaceCounters[],
  seconds: number
): ZotzNetworkRates {
  const before = new Map(previous.map((entry) => [entry.name, entry]))
  const rates: ZotzNetworkRates = {
    downBps: 0,
    upBps: 0,
    receivedBytes: 0,
    sentBytes: 0,
    interfaces: []
  }
  for (const entry of current) {
    const counted = zotzInterfaceCounts(platform, entry.name)
    if (counted) {
      rates.receivedBytes += entry.rxBytes
      rates.sentBytes += entry.txBytes
    }
    const old = before.get(entry.name)
    if (!old || seconds <= 0) {
      continue
    }
    const downBps = Math.round(grew(old.rxBytes, entry.rxBytes) / seconds)
    const upBps = Math.round(grew(old.txBytes, entry.txBytes) / seconds)
    if (counted) {
      rates.downBps += downBps
      rates.upBps += upBps
      if (downBps + upBps > 0) {
        rates.interfaces.push({ name: entry.name, downBps, upBps })
      }
    }
  }
  rates.interfaces = rates.interfaces
    .sort((a, b) => b.downBps + b.upBps - (a.downBps + a.upBps) || a.name.localeCompare(b.name))
    .slice(0, INTERFACE_LIMIT)
  return rates
}

export function zotzDiskRates(
  previous: readonly ZotzDiskCounters[],
  current: readonly ZotzDiskCounters[],
  seconds: number
): { readBps: number; writeBps: number } {
  const before = new Map(previous.map((entry) => [entry.id, entry]))
  let read = 0
  let write = 0
  for (const entry of current) {
    const old = before.get(entry.id)
    if (old) {
      read += grew(old.readBytes, entry.readBytes)
      write += grew(old.writeBytes, entry.writeBytes)
    }
  }
  return seconds > 0
    ? { readBps: Math.round(read / seconds), writeBps: Math.round(write / seconds) }
    : { readBps: 0, writeBps: 0 }
}
