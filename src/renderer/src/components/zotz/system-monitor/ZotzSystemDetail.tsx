import { cn } from '@/lib/class-names'
import { useTranslate, type Translate } from '@/i18n/use-translate'
import type {
  ZotzSystemMonitorSnapshot,
  ZotzSystemProcess,
  ZotzSystemReading
} from '../../../../../shared/zotz/system-monitor/zotz-system-monitor-contract'
import { ZotzSystemHistoryChart } from './ZotzSystemHistoryChart'
import {
  zotzPressureBadge,
  zotzSectionMax,
  zotzSectionSeries,
  type ZotzSystemSection
} from './zotz-system-sections'
import {
  formatZotzBytes,
  formatZotzDuration,
  formatZotzPercent,
  formatZotzRate
} from './zotz-system-format'

const TOP_PROCESSES = 6

type Stat = { label: string; value: React.ReactNode }

function Stats({ stats }: { stats: readonly Stat[] }): React.JSX.Element {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-0">
          <dt className="text-2xs text-muted-foreground">{stat.label}</dt>
          <dd className="truncate text-sm font-medium tabular-nums">{stat.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="space-y-2 rounded-md border border-border bg-card p-2.5 text-card-foreground">
      <h3 className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Meter({ ratio }: { ratio: number }): React.JSX.Element {
  const clamped = Math.max(0, Math.min(1, ratio))
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className={cn('h-full', clamped >= 0.9 ? 'bg-destructive' : 'bg-primary')}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  )
}

function Legend({ items }: { items: readonly { label: string; primary: boolean }[] }) {
  return (
    <div className="flex gap-3 text-2xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1">
          <span
            className={cn(
              'h-0.5 w-3 rounded-full',
              item.primary ? 'bg-chart-2' : 'bg-muted-foreground'
            )}
          />
          {item.label}
        </span>
      ))}
    </div>
  )
}

function ProcessTable({
  title,
  processes,
  by
}: {
  title: string
  processes: readonly ZotzSystemProcess[] | null
  by: 'cpu' | 'memory'
}): React.JSX.Element | null {
  const t = useTranslate()
  if (!processes || processes.length === 0) {
    return null
  }
  const rows = processes
    .toSorted((a, b) =>
      by === 'cpu' ? b.cpuPercent - a.cpuPercent : b.memoryBytes - a.memoryBytes
    )
    .slice(0, TOP_PROCESSES)
  return (
    <Section title={title}>
      <table className="w-full table-fixed text-xs">
        <thead className="text-left text-2xs text-muted-foreground">
          <tr>
            <th className="font-normal">{t('zotz.systemMonitor.processName', 'Process')}</th>
            <th className="w-16 text-right font-normal">{t('zotz.systemMonitor.pid', 'PID')}</th>
            <th className="w-16 text-right font-normal">{t('zotz.systemMonitor.cpu', 'CPU')}</th>
            <th className="w-20 text-right font-normal">
              {t('zotz.systemMonitor.memory', 'Memory')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((process) => (
            <tr key={process.pid} className="border-t border-border">
              <td className="truncate py-1" title={process.command}>
                {process.name}
              </td>
              <td className="py-1 text-right text-muted-foreground tabular-nums">{process.pid}</td>
              <td className="py-1 text-right tabular-nums">
                {formatZotzPercent(process.cpuPercent)}
              </td>
              <td className="py-1 text-right tabular-nums">
                {formatZotzBytes(process.memoryBytes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  )
}

function batteryStateLabel(latest: ZotzSystemReading, t: Translate): string {
  switch (latest.power.battery?.state) {
    case 'charging':
      return t('zotz.systemMonitor.batteryCharging', 'Charging')
    case 'discharging':
      return t('zotz.systemMonitor.batteryDischarging', 'Discharging')
    case 'charged':
      return t('zotz.systemMonitor.batteryCharged', 'Charged')
    case 'not-charging':
      return t('zotz.systemMonitor.batteryNotCharging', 'Not charging')
    case null:
    case undefined:
      return '—'
  }
}

function detailStats(section: ZotzSystemSection, latest: ZotzSystemReading, t: Translate): Stat[] {
  const none = '—'
  switch (section) {
    case 'cpu':
      return [
        {
          label: t('zotz.systemMonitor.usage', 'Usage'),
          value: formatZotzPercent(latest.cpu.percent)
        },
        {
          label: t('zotz.systemMonitor.cpuUser', 'User'),
          value: formatZotzPercent(latest.cpu.userPercent)
        },
        {
          label: t('zotz.systemMonitor.cpuSystem', 'System'),
          value: formatZotzPercent(latest.cpu.systemPercent)
        },
        {
          label: t('zotz.systemMonitor.load', 'Load 1 · 5 · 15 min'),
          value: latest.cpu.load
            ? latest.cpu.load.map((value) => value.toFixed(2)).join(' · ')
            : none
        },
        {
          label: t('zotz.systemMonitor.uptime', 'Up for'),
          value: formatZotzDuration(latest.cpu.uptimeSeconds)
        },
        { label: t('zotz.systemMonitor.cpuModel', 'Model'), value: latest.cpu.model ?? none }
      ]
    case 'memory': {
      const memory = latest.memory
      return [
        {
          label: t('zotz.systemMonitor.memoryUsed', 'Used'),
          value: formatZotzBytes(memory.usedBytes)
        },
        {
          label: t('zotz.systemMonitor.memoryAvailable', 'Available'),
          value: formatZotzBytes(memory.availableBytes)
        },
        {
          label: t('zotz.systemMonitor.memoryTotal', 'Total'),
          value: formatZotzBytes(memory.totalBytes)
        },
        {
          label: t('zotz.systemMonitor.swap', 'Swap'),
          value:
            memory.swapUsedBytes === null
              ? none
              : memory.swapTotalBytes
                ? `${formatZotzBytes(memory.swapUsedBytes)} / ${formatZotzBytes(memory.swapTotalBytes)}`
                : formatZotzBytes(memory.swapUsedBytes)
        },
        {
          label: t('zotz.systemMonitor.pressure', 'Pressure'),
          value:
            zotzPressureBadge(memory.pressure, t) ?? t('zotz.systemMonitor.pressureOk', 'Normal')
        },
        {
          label: t('zotz.systemMonitor.minFree', 'Zotz keeps free'),
          value: formatZotzBytes(memory.minFreeBytes)
        }
      ]
    }
    case 'network': {
      const network = latest.network
      return [
        {
          label: t('zotz.systemMonitor.download', 'Download'),
          value: network ? formatZotzRate(network.downBps) : none
        },
        {
          label: t('zotz.systemMonitor.upload', 'Upload'),
          value: network ? formatZotzRate(network.upBps) : none
        },
        {
          label: t('zotz.systemMonitor.defaultInterface', 'Default interface'),
          value: network?.defaultInterface ?? none
        },
        {
          label: t('zotz.systemMonitor.received', 'Received since boot'),
          value: network?.receivedBytes == null ? none : formatZotzBytes(network.receivedBytes)
        },
        {
          label: t('zotz.systemMonitor.sent', 'Sent since boot'),
          value: network?.sentBytes == null ? none : formatZotzBytes(network.sentBytes)
        }
      ]
    }
    case 'disk': {
      const startup = latest.disk.startup
      return [
        {
          label: t('zotz.systemMonitor.diskRead', 'Read'),
          value: latest.disk.readBps === null ? none : formatZotzRate(latest.disk.readBps)
        },
        {
          label: t('zotz.systemMonitor.diskWrite', 'Write'),
          value: latest.disk.writeBps === null ? none : formatZotzRate(latest.disk.writeBps)
        },
        {
          label: t('zotz.systemMonitor.startupDisk', 'Startup disk'),
          value: startup?.name ?? none
        },
        {
          label: t('zotz.systemMonitor.diskFree', 'Free'),
          value: startup ? formatZotzBytes(startup.availableBytes) : none
        },
        {
          label: t('zotz.systemMonitor.diskSize', 'Size'),
          value: startup ? formatZotzBytes(startup.totalBytes) : none
        }
      ]
    }
    case 'gpu':
      return [
        {
          label: t('zotz.systemMonitor.usage', 'Usage'),
          value: latest.gpu ? formatZotzPercent(latest.gpu.percent) : none
        },
        { label: t('zotz.systemMonitor.gpuModel', 'Model'), value: latest.gpu?.model ?? none }
      ]
    case 'energy': {
      const battery = latest.power.battery
      return [
        {
          label: t('zotz.systemMonitor.powerSource', 'Power source'),
          value: latest.power.onBattery
            ? t('zotz.systemMonitor.energyOnBattery', 'On battery')
            : t('zotz.systemMonitor.energyAc', 'Power adapter')
        },
        {
          label: t('zotz.systemMonitor.batteryLevel', 'Battery'),
          value: battery
            ? formatZotzPercent(battery.percent)
            : t('zotz.systemMonitor.energyNoBattery', 'No battery')
        },
        {
          label: t('zotz.systemMonitor.batteryState', 'State'),
          value: battery ? batteryStateLabel(latest, t) : none
        },
        {
          label: t('zotz.systemMonitor.timeLeft', 'Time left'),
          value: battery?.minutesLeft == null ? none : formatZotzDuration(battery.minutesLeft * 60)
        }
      ]
    }
  }
}

function legend(section: ZotzSystemSection, t: Translate): { label: string; primary: boolean }[] {
  if (section === 'network') {
    return [
      { label: t('zotz.systemMonitor.download', 'Download'), primary: true },
      { label: t('zotz.systemMonitor.upload', 'Upload'), primary: false }
    ]
  }
  if (section === 'disk') {
    return [
      { label: t('zotz.systemMonitor.diskRead', 'Read'), primary: true },
      { label: t('zotz.systemMonitor.diskWrite', 'Write'), primary: false }
    ]
  }
  return []
}

/** One section in full: a larger chart, every number the sampler has, and what drives it. */
export function ZotzSystemDetail({
  section,
  snapshot,
  latest
}: {
  section: ZotzSystemSection
  snapshot: ZotzSystemMonitorSnapshot
  latest: ZotzSystemReading
}): React.JSX.Element {
  const t = useTranslate()
  const items = legend(section, t)
  return (
    <div className="space-y-2" data-zotz-system-detail={section}>
      <div className="space-y-2 rounded-md border border-border bg-card p-2.5 text-card-foreground">
        <ZotzSystemHistoryChart
          className="h-32"
          series={zotzSectionSeries(section, snapshot.history)}
          endAt={latest.sampledAt}
          windowMs={snapshot.historyMs}
          intervalMs={snapshot.intervalMs}
          max={zotzSectionMax(section, latest)}
        />
        {items.length > 0 ? <Legend items={items} /> : null}
        <Stats stats={detailStats(section, latest, t)} />
      </div>
      {section === 'cpu' ? (
        <Section title={t('zotz.systemMonitor.cores', 'Cores')}>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {latest.cpu.cores
              .map((percent, position) => ({ core: position + 1, percent }))
              .map(({ core, percent }) => (
                <div key={core} className="space-y-1">
                  <Meter ratio={percent / 100} />
                  <div className="text-3xs text-muted-foreground tabular-nums">
                    {core} · {formatZotzPercent(percent)}
                  </div>
                </div>
              ))}
          </div>
        </Section>
      ) : null}
      {section === 'memory' ? (
        <Section title={t('zotz.systemMonitor.memoryUsedShare', 'Used of total')}>
          <Meter ratio={latest.memory.usedBytes / Math.max(1, latest.memory.totalBytes)} />
        </Section>
      ) : null}
      {section === 'network' && latest.network && latest.network.interfaces.length > 0 ? (
        <Section title={t('zotz.systemMonitor.interfaces', 'Busiest interfaces')}>
          <ul className="space-y-1 text-xs">
            {latest.network.interfaces.map((entry) => (
              <li key={entry.name} className="flex gap-2 tabular-nums">
                <span className="min-w-0 flex-1 truncate font-mono">{entry.name}</span>
                <span>↓ {formatZotzRate(entry.downBps)}</span>
                <span className="text-muted-foreground">↑ {formatZotzRate(entry.upBps)}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {section === 'disk' && latest.disk.startup ? (
        <Section title={latest.disk.startup.name}>
          <Meter
            ratio={
              1 - latest.disk.startup.availableBytes / Math.max(1, latest.disk.startup.totalBytes)
            }
          />
          <div className="text-2xs text-muted-foreground">
            {t('zotz.systemMonitor.diskFreeOf', '{{free}} free of {{total}}', {
              free: formatZotzBytes(latest.disk.startup.availableBytes),
              total: formatZotzBytes(latest.disk.startup.totalBytes)
            })}
          </div>
        </Section>
      ) : null}
      {section === 'cpu' ? (
        <ProcessTable
          title={t('zotz.systemMonitor.topCpu', 'Using the most CPU')}
          processes={latest.processes}
          by="cpu"
        />
      ) : null}
      {section === 'memory' ? (
        <ProcessTable
          title={t('zotz.systemMonitor.topMemory', 'Using the most memory')}
          processes={latest.processes}
          by="memory"
        />
      ) : null}
    </div>
  )
}
