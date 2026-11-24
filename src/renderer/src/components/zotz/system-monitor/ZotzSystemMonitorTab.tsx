import { useZotzWorkspaceNames } from '../agent-queue/use-zotz-workspace-names'
import { ZotzSystemMonitorPanel } from './ZotzSystemMonitorPanel'
import { useZotzSystemMonitor } from './zotz-system-monitor-store'

/** Mounted only while the System tab shows, so main samples only then. */
export function ZotzSystemMonitorTab(): React.JSX.Element {
  return (
    <ZotzSystemMonitorPanel
      snapshot={useZotzSystemMonitor()}
      workspaceName={useZotzWorkspaceNames()}
    />
  )
}
