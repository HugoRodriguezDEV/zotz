import { useMemo, useState } from 'react'
import { Server } from 'lucide-react'
import { HostCombobox, type HostComboboxOption } from '@/components/host-picker/HostCombobox'
import { useTranslate } from '@/i18n/use-translate'
import { useZotzWorkspaceNames } from '../agent-queue/use-zotz-workspace-names'
import { ZotzSystemMonitorPanel } from './ZotzSystemMonitorPanel'
import { useZotzHostSystemMonitor } from './use-zotz-host-system-monitor'
import { useZotzSystemMachines, type ZotzSystemMachine } from './use-zotz-system-machines'
import { remoteZotzSystemMonitorClient } from './zotz-system-monitor-client'
import { useZotzSystemMonitor } from './zotz-system-monitor-store'

function LocalSystem({
  workspaceName
}: {
  workspaceName: (worktreeId: string | null) => string
}): React.JSX.Element {
  return <ZotzSystemMonitorPanel snapshot={useZotzSystemMonitor()} workspaceName={workspaceName} />
}

function ServerSystem({
  machine,
  environmentId,
  workspaceName
}: {
  machine: ZotzSystemMachine
  environmentId: string
  workspaceName: (worktreeId: string | null) => string
}): React.JSX.Element {
  const t = useTranslate()
  const { snapshot, failed } = useZotzHostSystemMonitor(environmentId)
  const client = useMemo(
    () => remoteZotzSystemMonitorClient(environmentId, machine.canClose),
    [environmentId, machine.canClose]
  )
  if (failed && !snapshot) {
    return (
      <div className="px-1 py-6 text-center text-xs text-muted-foreground">
        {t('zotz.systemMonitor.serverFailed', 'Could not read {{name}}. Check that it is online.', {
          name: machine.name
        })}
      </div>
    )
  }
  return (
    <ZotzSystemMonitorPanel
      snapshot={snapshot}
      client={client}
      machineName={machine.name}
      workspaceName={workspaceName}
    />
  )
}

/** Mounted only while the System tab shows: the picked machine samples only then (docs/zotz/specs/SPEC-monitor-y-remotos.md §A.5). */
export function ZotzSystemMonitorTab(): React.JSX.Element {
  const t = useTranslate()
  const machines = useZotzSystemMachines()
  const workspaceName = useZotzWorkspaceNames()
  const [picked, setPicked] = useState<string>(machines[0].key)
  // A server that went away falls back to this machine.
  const machine = machines.find((entry) => entry.key === picked) ?? machines[0]
  const options: HostComboboxOption[] = machines.map((entry) => ({
    id: entry.key,
    label: entry.environmentId
      ? entry.name
      : t('zotz.systemMonitor.thisMachineNamed', '{{name}} (this machine)', { name: entry.name })
  }))
  return (
    <div className="space-y-2">
      {machines.length > 1 ? (
        <div
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          data-zotz-system-machine-picker=""
        >
          <Server className="size-3.5" />
          <span>{t('zotz.systemMonitor.machine', 'Machine')}</span>
          <HostCombobox
            value={machine.key}
            onChange={setPicked}
            options={options}
            size="sm"
            className="w-56"
            ariaLabel={t('zotz.systemMonitor.machine', 'Machine')}
          />
        </div>
      ) : null}
      {machine.environmentId ? (
        <ServerSystem
          key={machine.key}
          machine={machine}
          environmentId={machine.environmentId}
          workspaceName={workspaceName}
        />
      ) : (
        <LocalSystem workspaceName={workspaceName} />
      )}
    </div>
  )
}
