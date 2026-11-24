import { ipcRenderer } from 'electron'
import type {
  ZotzSystemMonitorUpdate,
  ZotzSystemProcessCloseRequest
} from '../../../shared/zotz/system-monitor/zotz-system-monitor-contract'
import type { PreloadApi } from '../../api-types'

export const zotzSystemMonitorApi = {
  watch: () => ipcRenderer.invoke('zotzSystemMonitor:watch'),
  unwatch: () => ipcRenderer.invoke('zotzSystemMonitor:unwatch'),
  onChanged: (callback: (update: ZotzSystemMonitorUpdate) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, update: ZotzSystemMonitorUpdate): void =>
      callback(update)
    ipcRenderer.on('zotzSystemMonitor:changed', listener)
    return () => ipcRenderer.removeListener('zotzSystemMonitor:changed', listener)
  },
  processes: () => ipcRenderer.invoke('zotzSystemMonitor:processes'),
  processCommand: (pid: number) => ipcRenderer.invoke('zotzSystemMonitor:processCommand', pid),
  closeProcess: (request: ZotzSystemProcessCloseRequest) =>
    ipcRenderer.invoke('zotzSystemMonitor:closeProcess', request)
} satisfies PreloadApi['zotzSystemMonitor']
