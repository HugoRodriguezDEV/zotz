import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/class-names'
import { useTranslate, type Translate } from '@/i18n/use-translate'
import type {
  ZotzSystemProcessEntry,
  ZotzSystemProcessList
} from '../../../../../shared/zotz/system-monitor/zotz-system-monitor-contract'
import { ZotzCloseProcessDialog } from './ZotzCloseProcessDialog'
import { formatZotzBytes, formatZotzPercent } from './zotz-system-format'
import type { ZotzSystemMonitorClient } from './zotz-system-monitor-client'

type SortKey = 'name' | 'pid' | 'user' | 'cpu' | 'memory'
type Sort = { key: SortKey; descending: boolean }

// Enough to scan; the filter finds the rest without rendering hundreds of rows.
const ROW_LIMIT = 200

function compare(a: ZotzSystemProcessEntry, b: ZotzSystemProcessEntry, key: SortKey): number {
  switch (key) {
    case 'name':
      return a.name.localeCompare(b.name)
    case 'pid':
      return a.pid - b.pid
    case 'user':
      return (a.user ?? '').localeCompare(b.user ?? '')
    case 'cpu':
      return a.cpuPercent - b.cpuPercent
    case 'memory':
      return a.memoryBytes - b.memoryBytes
  }
}

function matches(entry: ZotzSystemProcessEntry, needle: string, ownerText: string): boolean {
  if (needle === '') {
    return true
  }
  return [entry.name, entry.command, entry.user ?? '', String(entry.pid), ownerText].some((text) =>
    text.toLowerCase().includes(needle)
  )
}

export function zotzOwnerLabel(
  entry: ZotzSystemProcessEntry,
  workspaceName: (worktreeId: string | null) => string,
  t: Translate
): string {
  switch (entry.owner?.kind) {
    case 'agent': {
      const workspace = workspaceName(entry.owner.worktreeId)
      return workspace ? `${entry.owner.agent} · ${workspace}` : entry.owner.agent
    }
    case 'zotz':
      return 'Zotz'
    case 'zotz-child':
      return t('zotz.systemMonitor.ownerZotzChild', 'in Zotz')
    case undefined:
      return ''
  }
}

function OwnerMark({ entry, label }: { entry: ZotzSystemProcessEntry; label: string }) {
  if (!entry.owner) {
    return null
  }
  if (entry.owner.kind === 'zotz-child') {
    return <span className="shrink-0 text-2xs text-muted-foreground">{label}</span>
  }
  return (
    <Badge variant={entry.owner.kind === 'agent' ? 'secondary' : 'outline'} className="shrink-0">
      {label}
    </Badge>
  )
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
  align = 'right',
  className
}: {
  label: string
  column: SortKey
  sort: Sort
  onSort: (key: SortKey) => void
  align?: 'left' | 'right'
  className?: string
}): React.JSX.Element {
  const active = sort.key === column
  const Arrow = sort.descending ? ArrowDown : ArrowUp
  return (
    <th
      className={cn('font-normal', className)}
      aria-sort={active ? (sort.descending ? 'descending' : 'ascending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          align === 'right' && 'flex-row-reverse',
          active && 'text-foreground'
        )}
      >
        {label}
        {active ? <Arrow className="size-3" /> : null}
      </button>
    </th>
  )
}

function ProcessDetail({
  entry,
  parent,
  ownerText,
  client,
  onClose,
  onDismiss
}: {
  entry: ZotzSystemProcessEntry
  parent: ZotzSystemProcessEntry | undefined
  ownerText: string
  client: ZotzSystemMonitorClient
  /** Absent when this machine does not accept closing processes from here. */
  onClose?: () => void
  onDismiss: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const [command, setCommand] = useState<{ pid: number; text: string | null } | null>(null)
  useEffect(() => {
    let cancelled = false
    void client.processCommand(entry.pid).then(
      (text) => {
        if (!cancelled) {
          setCommand({ pid: entry.pid, text })
        }
      },
      () => {}
    )
    return () => {
      cancelled = true
    }
  }, [entry.pid, client])
  const commandText = command?.pid === entry.pid && command.text ? command.text : entry.command
  const fields: { label: string; value: string }[] = [
    { label: t('zotz.systemMonitor.pid', 'PID'), value: String(entry.pid) },
    {
      label: t('zotz.systemMonitor.parent', 'Parent'),
      value: parent ? `${parent.name} (${entry.ppid})` : String(entry.ppid)
    },
    { label: t('zotz.systemMonitor.user', 'User'), value: entry.user ?? '—' },
    { label: t('zotz.systemMonitor.cpu', 'CPU'), value: formatZotzPercent(entry.cpuPercent) },
    { label: t('zotz.systemMonitor.memory', 'Memory'), value: formatZotzBytes(entry.memoryBytes) },
    {
      label: t('zotz.systemMonitor.owner', 'Belongs to'),
      value: ownerText || t('zotz.systemMonitor.ownerNone', 'Nothing in Zotz')
    }
  ]
  return (
    <section
      className="space-y-2 rounded-md border border-border bg-card p-2.5 text-card-foreground"
      data-zotz-process-detail={entry.pid}
    >
      <div className="flex items-center gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold">{entry.name}</h3>
        {onClose ? (
          <Button
            type="button"
            variant="destructive"
            size="xs"
            className="ml-auto"
            onClick={onClose}
          >
            {t('zotz.systemMonitor.closeProcess', 'Close process')}
          </Button>
        ) : (
          <span className="ml-auto" />
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t('zotz.systemMonitor.hideDetail', 'Hide detail')}
          onClick={onDismiss}
        >
          <X className="size-3.5" />
        </Button>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-3">
        {fields.map((field) => (
          <div key={field.label} className="min-w-0">
            <dt className="text-2xs text-muted-foreground">{field.label}</dt>
            <dd className="truncate text-sm font-medium tabular-nums">{field.value}</dd>
          </div>
        ))}
      </dl>
      <div className="min-w-0">
        <div className="text-2xs text-muted-foreground">
          {t('zotz.systemMonitor.command', 'Command')}
        </div>
        <div className="font-mono text-xs break-all">{commandText}</div>
      </div>
    </section>
  )
}

/** docs/zotz/specs/SPEC-monitor-y-remotos.md §A.3: every process, filterable and sortable, with a way to close one. */
export function ZotzSystemProcessesView({
  list,
  client,
  workspaceName,
  initialPid = null
}: {
  list: ZotzSystemProcessList | null
  client: ZotzSystemMonitorClient
  workspaceName: (worktreeId: string | null) => string
  initialPid?: number | null
}): React.JSX.Element {
  const t = useTranslate()
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<Sort>({ key: 'cpu', descending: true })
  const [selectedPid, setSelectedPid] = useState<number | null>(initialPid)
  const [closing, setClosing] = useState<ZotzSystemProcessEntry | null>(null)
  // Closed until main reads the list again, so a gone row does not linger for a sample.
  const [closed, setClosed] = useState<{ pid: number; before: number | null } | null>(null)
  if (!list) {
    return (
      <div className="px-1 py-6 text-center text-xs text-muted-foreground">
        {t('zotz.systemMonitor.processesLoading', 'Reading processes…')}
      </div>
    )
  }
  const hidden = closed && (list.sampledAt ?? 0) <= (closed.before ?? 0) ? closed.pid : null
  const byPid = new Map(list.processes.map((entry) => [entry.pid, entry]))
  const needle = filter.trim().toLowerCase()
  const rows = list.processes
    .filter((entry) => entry.pid !== hidden)
    .map((entry) => ({ entry, owner: zotzOwnerLabel(entry, workspaceName, t) }))
    .filter(({ entry, owner }) => matches(entry, needle, owner.toLowerCase()))
    .sort((a, b) => {
      const order = compare(a.entry, b.entry, sort.key)
      return sort.descending ? -order : order
    })
  const shown = rows.slice(0, ROW_LIMIT)
  const selected = selectedPid === null ? undefined : byPid.get(selectedPid)
  const onSort = (key: SortKey): void =>
    setSort((current) =>
      current.key === key
        ? { key, descending: !current.descending }
        : { key, descending: key !== 'name' && key !== 'user' }
    )
  return (
    <div className="space-y-2" data-zotz-system-processes="">
      <div className="flex items-center gap-2">
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={t(
            'zotz.systemMonitor.processesFilter',
            'Filter by name, PID, user, command or agent'
          )}
          aria-label={t('zotz.systemMonitor.processesFilterLabel', 'Filter processes')}
          className="h-8 max-w-sm"
        />
        <span className="ml-auto shrink-0 text-2xs text-muted-foreground tabular-nums">
          {rows.length > ROW_LIMIT
            ? t(
                'zotz.systemMonitor.processesShownLimited',
                '{{shown}} of {{count}} · filter to see more',
                {
                  shown: ROW_LIMIT,
                  count: rows.length
                }
              )
            : t('zotz.systemMonitor.processesShown', '{{count}} of {{total}}', {
                count: rows.length,
                total: list.processes.length
              })}
        </span>
      </div>
      {selected ? (
        <ProcessDetail
          entry={selected}
          parent={byPid.get(selected.ppid)}
          ownerText={zotzOwnerLabel(selected, workspaceName, t)}
          client={client}
          onClose={client.closeProcess ? () => setClosing(selected) : undefined}
          onDismiss={() => setSelectedPid(null)}
        />
      ) : null}
      <div className="rounded-md border border-border bg-card p-2.5 text-card-foreground">
        <table className="w-full table-fixed text-xs">
          <thead className="text-left text-2xs text-muted-foreground">
            <tr>
              <SortHeader
                label={t('zotz.systemMonitor.processName', 'Process')}
                column="name"
                sort={sort}
                onSort={onSort}
                align="left"
              />
              <SortHeader
                label={t('zotz.systemMonitor.pid', 'PID')}
                column="pid"
                sort={sort}
                onSort={onSort}
                className="w-16 text-right"
              />
              <SortHeader
                label={t('zotz.systemMonitor.user', 'User')}
                column="user"
                sort={sort}
                onSort={onSort}
                className="w-24 text-right"
              />
              <SortHeader
                label={t('zotz.systemMonitor.cpu', 'CPU')}
                column="cpu"
                sort={sort}
                onSort={onSort}
                className="w-16 text-right"
              />
              <SortHeader
                label={t('zotz.systemMonitor.memory', 'Memory')}
                column="memory"
                sort={sort}
                onSort={onSort}
                className="w-20 text-right"
              />
            </tr>
          </thead>
          <tbody>
            {shown.map(({ entry, owner }) => (
              <tr
                key={entry.pid}
                data-current={entry.pid === selectedPid ? 'true' : undefined}
                className="cursor-pointer border-t border-border hover:bg-accent data-[current=true]:bg-accent"
                onClick={() => setSelectedPid(entry.pid)}
              >
                <td className="py-1">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <button
                      type="button"
                      className="min-w-0 truncate text-left focus-visible:underline focus-visible:outline-none"
                      title={entry.command}
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedPid(entry.pid)
                      }}
                    >
                      {entry.name}
                    </button>
                    <OwnerMark entry={entry} label={owner} />
                  </span>
                </td>
                <td className="py-1 text-right text-muted-foreground tabular-nums">{entry.pid}</td>
                <td className="truncate py-1 text-right text-muted-foreground">
                  {entry.user ?? '—'}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {formatZotzPercent(entry.cpuPercent)}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {formatZotzBytes(entry.memoryBytes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 ? (
          <div className="py-3 text-center text-xs text-muted-foreground">
            {t('zotz.systemMonitor.processesNone', 'No process matches')}
          </div>
        ) : null}
      </div>
      {client.closeProcess ? (
        <ZotzCloseProcessDialog
          target={closing}
          workspaceName={workspaceName}
          closeProcess={client.closeProcess}
          onDone={(wasClosed) => {
            if (wasClosed && closing) {
              setClosed({ pid: closing.pid, before: list.sampledAt })
              setSelectedPid(null)
            }
            setClosing(null)
          }}
        />
      ) : null}
    </div>
  )
}
