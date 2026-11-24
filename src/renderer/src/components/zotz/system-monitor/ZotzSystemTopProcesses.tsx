import { useTranslate } from '@/i18n/use-translate'
import type { ZotzSystemProcess } from '../../../../../shared/zotz/system-monitor/zotz-system-monitor-contract'
import { formatZotzBytes, formatZotzPercent } from './zotz-system-format'

const TOP_PROCESSES = 6

/** The few processes using the most CPU or memory; a row opens it in the Processes view. */
export function ZotzSystemTopProcesses({
  title,
  processes,
  by,
  onOpen
}: {
  title: string
  processes: readonly ZotzSystemProcess[] | null
  by: 'cpu' | 'memory'
  onOpen: (pid: number) => void
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
    <section className="space-y-2 rounded-md border border-border bg-card p-2.5 text-card-foreground">
      <h3 className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </h3>
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
            <tr
              key={process.pid}
              className="cursor-pointer border-t border-border hover:bg-accent"
              onClick={() => onOpen(process.pid)}
            >
              <td className="truncate py-1" title={process.command}>
                <button
                  type="button"
                  className="max-w-full truncate text-left focus-visible:underline focus-visible:outline-none"
                  onClick={(event) => {
                    event.stopPropagation()
                    onOpen(process.pid)
                  }}
                >
                  {process.name}
                </button>
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
    </section>
  )
}
