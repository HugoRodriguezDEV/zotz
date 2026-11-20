import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../../api-types'

export const zotzTaskConnectorsApi = {
  snapshot: () => ipcRenderer.invoke('zotzTasks:snapshot'),
  refresh: (connectors) => ipcRenderer.invoke('zotzTasks:refresh', connectors),
  setToken: (id, token) => ipcRenderer.invoke('zotzTasks:setToken', id, token),
  importFile: () => ipcRenderer.invoke('zotzTasks:importFile'),
  remove: (id) => ipcRenderer.invoke('zotzTasks:remove', id)
} satisfies PreloadApi['zotzTaskConnectors']
