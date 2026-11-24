import { useState } from 'react'
import {
  ArrowLeft,
  Battery,
  Cpu,
  Gpu,
  HardDrive,
  ListTree,
  MemoryStick,
  Network
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/class-names'
import { useTranslate, type Translate } from '@/i18n/use-translate'
import type {
  ZotzSystemMonitorSnapshot,
  ZotzSystemProcessList,
  ZotzSystemReading
} from '../../../../../shared/zotz/system-monitor/zotz-system-monitor-contract'
import { ZotzSystemHistoryChart } from './ZotzSystemHistoryChart'
import { ZotzSystemDetail } from './ZotzSystemDetail'
import { ZotzSystemProcessesView } from './ZotzSystemProcessesView'
import { useZotzSystemProcesses } from './use-zotz-system-processes'
import {
  LOCAL_ZOTZ_SYSTEM_MONITOR_CLIENT,
  type ZotzSystemMonitorClient
} from './zotz-system-monitor-client'
import {
  ZOTZ_SYSTEM_SECTIONS,
  zotzPressureBadge,
  zotzSectionMax,
  zotzSectionSeries,
  zotzSystemSectionTitle,
  type ZotzSystemSection
} from './zotz-system-sections'
import { formatZotzBytes, formatZotzPercent, formatZotzRate } from './zotz-system-format'

const ICONS = {
  cpu: Cpu,
  memory: MemoryStick,
  network: Network,
  disk: HardDrive,
  gpu: Gpu,
  energy: Battery
} as const

type CardText = { value: string; detail: string; available: boolean }

function cardText(section: ZotzSystemSection, latest: ZotzSystemReading, t: Translate): CardText {
  const missing = (detail: string): CardText => ({
    value: t('zotz.systemMonitor.noReading', 'No reading'),
    detail,
    available: false
  })
  switch (section) {
    case 'cpu':
      return {
        value: formatZotzPercent(latest.cpu.percent),
        detail: latest.cpu.load
          ? t('zotz.systemMonitor.cpuCardLoad', '{{cores}} cores · load {{load}}', {
              cores: latest.cpu.cores.length,
              load: latest.cpu.load[0].toFixed(2)
            })
          : t('zotz.systemMonitor.cpuCard', '{{cores}} cores', {
              cores: latest.cpu.cores.length
            }),
        available: true
      }
    case 'memory':
      return {
        value: formatZotzBytes(latest.memory.usedBytes),
        detail:
          latest.memory.swapUsedBytes === null
            ? t('zotz.systemMonitor.memoryCard', 'of {{total}}', {
                total: formatZotzBytes(latest.memory.totalBytes)
              })
            : t('zotz.systemMonitor.memoryCardSwap', 'of {{total}} · swap {{swap}}', {
                total: formatZotzBytes(latest.memory.totalBytes),
                swap: formatZotzBytes(latest.memory.swapUsedBytes)
              }),
        available: true
      }
    case 'network':
      return latest.network
        ? {
            value: `↓ ${formatZotzRate(latest.network.downBps)}`,
            detail: latest.network.defaultInterface
              ? t('zotz.systemMonitor.networkCardInterface', '↑ {{up}} · {{name}}', {
                  up: formatZotzRate(latest.network.upBps),
                  name: latest.network.defaultInterface
                })
              : `↑ ${formatZotzRate(latest.network.upBps)}`,
            available: true
          }
        : missing(t('zotz.systemMonitor.networkMissing', 'No traffic reading yet'))
    case 'disk': {
      const startup = latest.disk.startup
      const io =
        latest.disk.readBps === null || latest.disk.writeBps === null
          ? null
          : t('zotz.systemMonitor.diskCardIo', 'read {{read}} · write {{write}}', {
              read: formatZotzRate(latest.disk.readBps),
              write: formatZotzRate(latest.disk.writeBps)
            })
      if (!startup) {
        return io
          ? { value: formatZotzRate(latest.disk.readBps ?? 0), detail: io, available: true }
          : missing(t('zotz.systemMonitor.diskMissing', 'The disk gave no reading'))
      }
      return {
        value: t('zotz.systemMonitor.diskCardFree', '{{free}} free', {
          free: formatZotzBytes(startup.availableBytes)
        }),
        detail: io ?? startup.name,
        available: true
      }
    }
    case 'gpu':
      return latest.gpu
        ? {
            value: formatZotzPercent(latest.gpu.percent),
            detail: latest.gpu.model ?? t('zotz.systemMonitor.gpuUnnamed', 'Graphics'),
            available: true
          }
        : missing(t('zotz.systemMonitor.gpuMissing', 'No GPU this machine can read'))
    case 'energy': {
      const battery = latest.power.battery
      if (!battery) {
        return {
          value: t('zotz.systemMonitor.energyAc', 'Power adapter'),
          detail: t('zotz.systemMonitor.energyNoBattery', 'No battery'),
          available: true
        }
      }
      return {
        value: formatZotzPercent(battery.percent),
        detail: latest.power.onBattery
          ? t('zotz.systemMonitor.energyOnBattery', 'On battery')
          : t('zotz.systemMonitor.energyOnAc', 'Plugged in'),
        available: true
      }
    }
  }
}

function SectionCard({
  section,
  snapshot,
  latest,
  onOpen
}: {
  section: ZotzSystemSection
  snapshot: ZotzSystemMonitorSnapshot
  latest: ZotzSystemReading
  onOpen: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const Icon = ICONS[section]
  const text = cardText(section, latest, t)
  return (
    <button
      type="button"
      onClick={onOpen}
      data-zotz-system-card={section}
      className="flex min-w-0 flex-col gap-1.5 rounded-md border border-border bg-card p-2.5 text-left text-card-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold">
        <Icon className="size-3.5 text-muted-foreground" />
        {zotzSystemSectionTitle(section, t)}
        <span className="ml-auto">
          {section === 'memory' ? zotzPressureBadge(latest.memory.pressure, t) : null}
        </span>
      </span>
      <span
        className={cn(
          'text-lg font-semibold whitespace-nowrap tabular-nums',
          !text.available && 'text-sm font-medium text-muted-foreground'
        )}
      >
        {text.value}
      </span>
      <span className="min-w-0 truncate text-2xs text-muted-foreground">{text.detail}</span>
      {text.available ? (
        <ZotzSystemHistoryChart
          className="h-10"
          series={zotzSectionSeries(section, snapshot.history)}
          endAt={latest.sampledAt}
          windowMs={snapshot.historyMs}
          intervalMs={snapshot.intervalMs}
          max={zotzSectionMax(section, latest)}
        />
      ) : (
        <span className="h-10" />
      )}
    </button>
  )
}

function ProcessesCard({
  latest,
  onOpen
}: {
  latest: ZotzSystemReading
  onOpen: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const busiest = latest.processes?.[0]
  return (
    <button
      type="button"
      onClick={onOpen}
      data-zotz-system-card="processes"
      className="flex min-w-0 flex-col gap-1.5 rounded-md border border-border bg-card p-2.5 text-left text-card-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold">
        <ListTree className="size-3.5 text-muted-foreground" />
        {t('zotz.systemMonitor.processes', 'Processes')}
      </span>
      <span className="min-w-0 truncate text-lg font-semibold">
        {busiest?.name ?? t('zotz.systemMonitor.processesLoading', 'Reading processes…')}
      </span>
      <span className="min-w-0 truncate text-2xs text-muted-foreground">
        {busiest
          ? t('zotz.systemMonitor.processesCard', 'Busiest now · {{cpu}} CPU · {{memory}}', {
              cpu: formatZotzPercent(busiest.cpuPercent),
              memory: formatZotzBytes(busiest.memoryBytes)
            })
          : ''}
      </span>
      <span className="text-2xs text-muted-foreground">
        {t('zotz.systemMonitor.processesCardHint', 'Filter, sort and close processes')}
      </span>
    </button>
  )
}

type ZotzSystemView = ZotzSystemSection | 'processes'

const workspaceIdAsName = (worktreeId: string | null): string => worktreeId ?? ''

/** docs/zotz/SPEC-monitor-y-remotos.md §A fases 2 y 3: this machine's vitals as cards, each with a detail view, and its processes. */
export function ZotzSystemMonitorPanel({
  snapshot,
  initialView = null,
  initialPid = null,
  processList,
  workspaceName = workspaceIdAsName,
  client = LOCAL_ZOTZ_SYSTEM_MONITOR_CLIENT,
  machineName = null
}: {
  snapshot: ZotzSystemMonitorSnapshot | null
  initialView?: ZotzSystemView | null
  initialPid?: number | null
  /** Fixtures pass the list; the app reads it from main while the Processes view is open. */
  processList?: ZotzSystemProcessList | null
  workspaceName?: (worktreeId: string | null) => string
  /** Where processes are read and closed; this machine unless a server is picked. */
  client?: ZotzSystemMonitorClient
  /** A server's name; null for this machine. */
  machineName?: string | null
}): React.JSX.Element {
  const t = useTranslate()
  const [open, setOpen] = useState<ZotzSystemView | null>(initialView)
  const [pid, setPid] = useState<number | null>(initialPid)
  const latest = snapshot?.latest
  const liveList = useZotzSystemProcesses(
    open === 'processes' && processList === undefined ? (latest?.processesSampledAt ?? null) : null,
    client
  )
  if (!snapshot || !latest) {
    return (
      <div className="px-1 py-6 text-center text-xs text-muted-foreground">
        {machineName
          ? t('zotz.systemMonitor.loadingServer', 'Reading {{name}}…', { name: machineName })
          : t('zotz.systemMonitor.loading', 'Reading this machine…')}
      </div>
    )
  }
  const header = (
    <div className="flex min-w-0 items-baseline gap-1.5 px-1 text-xs">
      <span className="font-semibold">
        {machineName ?? t('zotz.systemMonitor.thisMachine', 'This machine')}
      </span>
      <span className="min-w-0 truncate text-muted-foreground">{snapshot.hostname}</span>
      <span className="ml-auto shrink-0 text-2xs text-muted-foreground">
        {t('zotz.systemMonitor.historyWindow', 'Last {{minutes}} min', {
          minutes: Math.round(snapshot.historyMs / 60_000)
        })}
      </span>
    </div>
  )
  const openProcess = (next: number): void => {
    setPid(next)
    setOpen('processes')
  }
  if (open) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              setOpen(null)
              setPid(null)
            }}
          >
            <ArrowLeft className="size-3" />
            {t('zotz.systemMonitor.back', 'All')}
          </Button>
          <span className="text-sm font-semibold">
            {open === 'processes'
              ? t('zotz.systemMonitor.processes', 'Processes')
              : zotzSystemSectionTitle(open, t)}
          </span>
        </div>
        {header}
        {open === 'processes' ? (
          <ZotzSystemProcessesView
            key={pid ?? 'none'}
            list={processList === undefined ? liveList : processList}
            client={client}
            workspaceName={workspaceName}
            initialPid={pid}
          />
        ) : (
          <ZotzSystemDetail
            section={open}
            snapshot={snapshot}
            latest={latest}
            onOpenProcess={openProcess}
          />
        )}
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {header}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {ZOTZ_SYSTEM_SECTIONS.map((section) => (
          <SectionCard
            key={section}
            section={section}
            snapshot={snapshot}
            latest={latest}
            onOpen={() => setOpen(section)}
          />
        ))}
        <ProcessesCard latest={latest} onOpen={() => setOpen('processes')} />
      </div>
    </div>
  )
}
