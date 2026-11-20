import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../../api-types'
import type { ZotzTaskRelayUpdate } from '../../../shared/zotz/tasks/zotz-task-relay-types'

export const zotzTaskConnectorsApi = {
  onChanged: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on('zotzTasks:changed', listener)
    return () => ipcRenderer.removeListener('zotzTasks:changed', listener)
  },
  snapshot: () => ipcRenderer.invoke('zotzTasks:snapshot'),
  refresh: (connectors) => ipcRenderer.invoke('zotzTasks:refresh', connectors),
  setToken: (id, token) => ipcRenderer.invoke('zotzTasks:setToken', id, token),
  importFile: () => ipcRenderer.invoke('zotzTasks:importFile'),
  remove: (id) => ipcRenderer.invoke('zotzTasks:remove', id),
  syncPullRequests: (repos) => ipcRenderer.invoke('zotzTasks:syncPullRequests', repos),
  move: (id, taskId, optionId) => ipcRenderer.invoke('zotzTasks:move', id, taskId, optionId),
  development: (refs) => ipcRenderer.invoke('zotzTasks:development', refs),
  viewer: () => ipcRenderer.invoke('zotzTasks:viewer'),
  owners: () => ipcRenderer.invoke('zotzTasks:owners'),
  listOwnerRepos: (owner, ownerType) =>
    ipcRenderer.invoke('zotzTasks:listOwnerRepos', owner, ownerType),
  repoIssues: (repos) => ipcRenderer.invoke('zotzTasks:repoIssues', repos),
  linkPullRequest: (id, taskId, url) =>
    ipcRenderer.invoke('zotzTasks:linkPullRequest', id, taskId, url),
  onRelay: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, update: ZotzTaskRelayUpdate): void =>
      callback(update)
    ipcRenderer.on('zotzTasks:relay', listener)
    return () => ipcRenderer.removeListener('zotzTasks:relay', listener)
  },
  relayStatus: () => ipcRenderer.invoke('zotzTasks:relayStatus'),
  relayWatch: (active) => ipcRenderer.invoke('zotzTasks:relayWatch', active),
  relaySetToken: (token) => ipcRenderer.invoke('zotzTasks:relaySetToken', token),
  relayCheck: (url) => ipcRenderer.invoke('zotzTasks:relayCheck', url)
} satisfies PreloadApi['zotzTaskConnectors']
