import type {
  ZotzSystemMonitorSnapshot,
  ZotzSystemReading,
  ZotzSystemSample
} from '../../../../../shared/zotz/system-monitor/zotz-system-monitor-contract'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import { ZotzSystemMonitorPanel } from './ZotzSystemMonitorPanel'

const GB = 1024 ** 3
const MB = 1024 ** 2
const NOW = 1_800_000_000_000
const INTERVAL = 2_000
const WINDOW = 10 * 60_000

// Seven minutes watched, a three-minute gap (tab closed), then watched again.
function history(): ZotzSystemSample[] {
  const samples: ZotzSystemSample[] = []
  for (let t = NOW - WINDOW + 30_000; t <= NOW; t += INTERVAL) {
    if (t > NOW - 5 * 60_000 && t < NOW - 2 * 60_000) {
      continue
    }
    const i = (t - NOW) / INTERVAL
    samples.push({
      t,
      cpuPercent: 38 + 22 * Math.sin(i / 9) + 8 * Math.sin(i / 2.3),
      memoryUsedBytes: (21 + 2 * Math.sin(i / 40)) * GB,
      swapUsedBytes: 3.1 * GB,
      netDownBps: Math.max(0, (1.4 + Math.sin(i / 5)) * MB),
      netUpBps: Math.max(0, (0.3 + 0.25 * Math.sin(i / 7)) * MB),
      diskReadBps: Math.max(0, (12 + 10 * Math.sin(i / 6)) * MB),
      diskWriteBps: Math.max(0, (5 + 4 * Math.sin(i / 4)) * MB),
      gpuPercent: 18 + 12 * Math.sin(i / 11),
      batteryPercent: 82 - (t - (NOW - WINDOW)) / 60_000
    })
  }
  return samples
}

const PROCESSES: ZotzSystemReading['processes'] = [
  ['node', 182, 3.1 * GB],
  ['claude', 64, 1.2 * GB],
  ['Zotz Helper (Renderer)', 22, 860 * MB],
  ['codex', 18, 2.4 * GB],
  ['WindowServer', 11, 420 * MB],
  ['pnpm', 6, 310 * MB],
  ['Google Chrome Helper', 4, 1.6 * GB]
].map(([name, cpu, memory], index) => ({
  pid: 4100 + index * 17,
  ppid: 1,
  name: String(name),
  command: `/usr/local/bin/${String(name)}`,
  user: 'hugo',
  cpuPercent: Number(cpu),
  memoryBytes: Number(memory)
}))

const MAC: ZotzSystemReading = {
  sampledAt: NOW,
  cpu: {
    model: 'Apple M1 Pro',
    percent: 41,
    userPercent: 29,
    systemPercent: 12,
    cores: [72, 64, 51, 47, 33, 28, 19, 12, 9, 6],
    load: [6.42, 5.8, 4.91],
    uptimeSeconds: 3 * 86_400 + 4 * 3_600
  },
  memory: {
    totalBytes: 32 * GB,
    usedBytes: 22.4 * GB,
    availableBytes: 9.6 * GB,
    swapUsedBytes: 3.1 * GB,
    swapTotalBytes: 4 * GB,
    pressure: 'elevated',
    minFreeBytes: 4.8 * GB
  },
  network: {
    downBps: 2.3 * MB,
    upBps: 410_000,
    receivedBytes: 48.7 * GB,
    sentBytes: 5.6 * GB,
    defaultInterface: 'en0',
    interfaces: [
      { name: 'en0', downBps: 2.2 * MB, upBps: 380_000 },
      { name: 'en5', downBps: 120_000, upBps: 30_000 }
    ]
  },
  disk: {
    readBps: 18 * MB,
    writeBps: 6.2 * MB,
    startup: {
      name: 'Macintosh HD',
      mount: '/',
      totalBytes: 994 * GB,
      availableBytes: 212 * GB
    }
  },
  gpu: { model: 'Apple M1 Pro', percent: 24 },
  power: { onBattery: true, battery: { percent: 72, state: 'discharging', minutesLeft: 192 } },
  processes: PROCESSES,
  processesSampledAt: NOW
}

const SNAPSHOT: ZotzSystemMonitorSnapshot = {
  platform: 'darwin',
  hostname: 'hugo-mbp',
  intervalMs: INTERVAL,
  historyMs: WINDOW,
  history: history(),
  latest: MAC
}

// The MSI: Windows desktop, no load average, no battery, no totals since boot.
const MSI: ZotzSystemMonitorSnapshot = {
  ...SNAPSHOT,
  platform: 'win32',
  hostname: 'MSI-ZOTZ',
  history: SNAPSHOT.history.map((sample) => ({
    ...sample,
    memoryUsedBytes: sample.memoryUsedBytes / 2,
    batteryPercent: null
  })),
  latest: {
    ...MAC,
    cpu: { ...MAC.cpu, model: 'Intel(R) Core(TM) i7-12700H', load: null },
    memory: { ...MAC.memory, totalBytes: 16 * GB, usedBytes: 11.2 * GB, pressure: 'ok' },
    network: { ...MAC.network!, receivedBytes: null, sentBytes: null, defaultInterface: null },
    disk: {
      ...MAC.disk,
      startup: { name: 'C:', mount: 'C:\\', totalBytes: 953 * GB, availableBytes: 401 * GB }
    },
    gpu: { model: 'NVIDIA GeForce RTX 3060 Laptop GPU', percent: 7 },
    power: { onBattery: false, battery: null }
  }
}

export const overview = defineFixture({
  width: 1000,
  render: () => <ZotzSystemMonitorPanel snapshot={SNAPSHOT} />
})

export const windowsServer = defineFixture({
  width: 1000,
  render: () => <ZotzSystemMonitorPanel snapshot={MSI} />
})

export const cpuDetail = defineFixture({
  width: 1000,
  render: () => <ZotzSystemMonitorPanel snapshot={SNAPSHOT} initialSection="cpu" />
})

export const memoryDetail = defineFixture({
  width: 1000,
  render: () => <ZotzSystemMonitorPanel snapshot={SNAPSHOT} initialSection="memory" />
})

export const networkDetail = defineFixture({
  width: 1000,
  render: () => <ZotzSystemMonitorPanel snapshot={SNAPSHOT} initialSection="network" />
})

export const loading = defineFixture({
  width: 600,
  render: () => <ZotzSystemMonitorPanel snapshot={null} />
})
