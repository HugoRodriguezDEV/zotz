import { app, ipcMain, powerMonitor, type IpcMainInvokeEvent } from 'electron'
import { readdir, readlink, statfs } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { computeZotzMemoryGovernorDefaults } from '../../../shared/zotz/agent-queue/zotz-memory-governor-defaults'
import {
  ZOTZ_SYSTEM_SAMPLE_INTERVAL_MS,
  type ZotzSystemProcessCloseRequest,
  type ZotzSystemVolume
} from '../../../shared/zotz/system-monitor/zotz-system-monitor-contract'
import { getLocalDaemonPid } from '../../memory/local-daemon-pid'
import { collectHostMemory } from '../../memory/host-memory'
import {
  collectZotzHostMemory,
  createZotzSystemMemorySignalsReader
} from '../memory-governor/zotz-darwin-memory-signals'
import type { ZotzMemoryGovernorService } from '../memory-governor/zotz-memory-governor-service'
import { createZotzDarwinSampler } from './zotz-system-darwin-sampler'
import { createZotzLinuxSampler } from './zotz-system-linux-sampler'
import { ZotzSystemMonitorService } from './zotz-system-monitor-service'
import { ZotzSystemStatusService } from './zotz-system-status-service'
import { registerZotzSystemMonitorSource } from './zotz-system-monitor-source'
import { closeZotzProcess, readZotzProcessCommandLine } from './zotz-system-process-control'
import { zotzProcessOwners, type ZotzAgentProcessRoot } from './zotz-system-process-owners'
import type { ZotzSystemPlatformSampler } from './zotz-system-platform-sampler'
import { createZotzWindowsSampler } from './zotz-system-windows-sampler'
import { createZotzWindowWatchers } from './zotz-window-watchers'

const DARWIN_DATA_VOLUME = '/System/Volumes/Data'

function createPlatformSampler(): ZotzSystemPlatformSampler {
  if (process.platform === 'darwin') {
    return createZotzDarwinSampler()
  }
  if (process.platform === 'win32') {
    return createZotzWindowsSampler(ZOTZ_SYSTEM_SAMPLE_INTERVAL_MS)
  }
  return createZotzLinuxSampler()
}

async function volumeAt(mount: string, name: string): Promise<ZotzSystemVolume | null> {
  try {
    const stats = await statfs(mount)
    return {
      name,
      mount,
      totalBytes: stats.blocks * stats.bsize,
      availableBytes: stats.bavail * stats.bsize
    }
  } catch {
    return null
  }
}

// Finder's name for the startup disk is the /Volumes link that points at "/".
async function darwinStartupName(): Promise<string | null> {
  try {
    for (const entry of await readdir('/Volumes', { withFileTypes: true })) {
      if (entry.isSymbolicLink() && (await readlink(path.join('/Volumes', entry.name))) === '/') {
        return entry.name
      }
    }
  } catch {
    // Unreadable /Volumes keeps the generic name.
  }
  return null
}

async function readStartupVolume(): Promise<ZotzSystemVolume | null> {
  if (process.platform === 'win32') {
    const drive = process.env.SystemDrive ?? 'C:'
    return volumeAt(`${drive}\\`, drive)
  }
  if (process.platform === 'darwin') {
    const name = (await darwinStartupName()) ?? '/'
    return (await volumeAt(DARWIN_DATA_VOLUME, name)) ?? volumeAt('/', name)
  }
  return volumeAt('/', '/')
}

// Only the app's own windows may start sampling the machine.
function isWindowRenderer(event: IpcMainInvokeEvent): boolean {
  return !event.sender.isDestroyed() && event.sender.getType() === 'window'
}

/** Zotz's own processes: main, every Electron helper and the terminal daemon. */
function zotzPids(): Set<number> {
  const pids = new Set<number>([process.pid])
  for (const metric of app.getAppMetrics()) {
    pids.add(metric.pid)
  }
  const daemon = getLocalDaemonPid()
  if (daemon !== null) {
    pids.add(daemon)
  }
  return pids
}

function closeRequest(value: unknown): ZotzSystemProcessCloseRequest | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('pid' in value) ||
    !('name' in value) ||
    !('force' in value)
  ) {
    return null
  }
  const { pid, name, force } = value
  return typeof pid === 'number' &&
    Number.isSafeInteger(pid) &&
    typeof name === 'string' &&
    typeof force === 'boolean'
    ? { pid, name, force }
    : null
}

/** docs/zotz/SPEC-monitor-y-remotos.md §A: the System tab's sampler, idle until a window watches. */
export function startZotzSystemMonitor(
  governor: ZotzMemoryGovernorService,
  listAgentRoots: () => ZotzAgentProcessRoot[]
): () => void {
  const service = new ZotzSystemMonitorService({
    platform: process.platform,
    hostname: os.hostname(),
    createPlatformSampler,
    collectHost: () => collectZotzHostMemory(collectHostMemory),
    readMemorySignals: createZotzSystemMemorySignalsReader(),
    limits: () => governor.getState()?.limits ?? computeZotzMemoryGovernorDefaults(os.totalmem()),
    readStartupVolume,
    isOnBatteryPower: () => powerMonitor.isOnBatteryPower(),
    cpus: () => os.cpus(),
    loadavg: () => os.loadavg(),
    uptime: () => os.uptime(),
    now: Date.now,
    ownersOf: (processes) => zotzProcessOwners(processes, listAgentRoots(), zotzPids()),
    publish: (update) => watchers.publish(update)
  })
  const watchers = createZotzWindowWatchers('zotzSystemMonitor:changed', service)
  ipcMain.handle('zotzSystemMonitor:watch', (event) =>
    isWindowRenderer(event) ? watchers.watch(event.sender) : null
  )
  ipcMain.handle('zotzSystemMonitor:unwatch', (event) => {
    watchers.unwatch(event.sender.id)
  })
  const unregisterSource = registerZotzSystemMonitorSource({
    service,
    processCommand: readZotzProcessCommandLine,
    closeProcess: closeZotzProcess
  })
  const status = new ZotzSystemStatusService({
    cpus: () => os.cpus(),
    governorState: () => governor.getState(),
    wakeGovernor: () => governor.wake(),
    now: Date.now,
    publish: (next) => statusWatchers.publish(next)
  })
  const statusWatchers = createZotzWindowWatchers('zotzSystemStatus:changed', status)
  ipcMain.handle('zotzSystemStatus:watch', (event) =>
    isWindowRenderer(event) ? statusWatchers.watch(event.sender) : null
  )
  ipcMain.handle('zotzSystemStatus:unwatch', (event) => {
    statusWatchers.unwatch(event.sender.id)
  })
  ipcMain.handle('zotzSystemMonitor:processes', (event) =>
    isWindowRenderer(event) ? service.processList() : { sampledAt: null, processes: [] }
  )
  ipcMain.handle('zotzSystemMonitor:processCommand', (event, pid: unknown) =>
    isWindowRenderer(event) && typeof pid === 'number' ? readZotzProcessCommandLine(pid) : null
  )
  ipcMain.handle('zotzSystemMonitor:closeProcess', (event, value: unknown) => {
    const request = closeRequest(value)
    if (!isWindowRenderer(event) || !request) {
      return { ok: false, reason: 'failed' }
    }
    return closeZotzProcess(request)
  })
  return () => {
    ipcMain.removeHandler('zotzSystemMonitor:watch')
    ipcMain.removeHandler('zotzSystemMonitor:unwatch')
    ipcMain.removeHandler('zotzSystemMonitor:processes')
    ipcMain.removeHandler('zotzSystemMonitor:processCommand')
    ipcMain.removeHandler('zotzSystemMonitor:closeProcess')
    unregisterSource()
    ipcMain.removeHandler('zotzSystemStatus:watch')
    ipcMain.removeHandler('zotzSystemStatus:unwatch')
    watchers.dispose()
    statusWatchers.dispose()
    service.dispose()
    status.dispose()
  }
}
