import { ipcRenderer } from 'electron'
import type { ZotzSystemMonitorUpdate } from '../../../shared/zotz/system-monitor/zotz-system-monitor-contract'
import type { PreloadApi } from '../../api-types'

export const zotzSystemMonitorApi = {
  watch: () => ipcRenderer.invoke('zotzSystemMonitor:watch'),
  unwatch: () => ipcRenderer.invoke('zotzSystemMonitor:unwatch'),
  onChanged: (callback: (update: ZotzSystemMonitorUpdate) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, update: ZotzSystemMonitorUpdate): void =>
      callback(update)
    ipcRenderer.on('zotzSystemMonitor:changed', listener)
    return () => ipcRenderer.removeListener('zotzSystemMonitor:changed', listener)
  }
} satisfies PreloadApi['zotzSystemMonitor']
