import { readFile, stat } from 'node:fs/promises'
import { BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import {
  ZOTZ_TASKS_MAX_BYTES,
  zotzTasksFormatFromName
} from '../../../shared/zotz/tasks/zotz-tasks-contract'
import {
  setActiveZotzTaskConnectors,
  type ZotzTaskSettingsStore
} from './zotz-task-connector-registry'
import { sendToTrustedUIRenderer } from '../../ipc/ui'
import type { ZotzTaskConnectorImportResult } from '../../../shared/zotz/tasks/zotz-task-connector-types'
import { ZotzTaskConnectorService } from './zotz-task-connector-service'
import { fetchZotzIssueDevelopment, fetchZotzViewerLogin } from './zotz-task-development'
import { fetchZotzRepoIssues, listZotzOwnerRepos, listZotzOwners } from './zotz-task-repos'

const CHANNELS = [
  'zotzTasks:snapshot',
  'zotzTasks:refresh',
  'zotzTasks:setToken',
  'zotzTasks:importFile',
  'zotzTasks:remove',
  'zotzTasks:syncPullRequests',
  'zotzTasks:move',
  'zotzTasks:development',
  'zotzTasks:viewer',
  'zotzTasks:linkPullRequest',
  'zotzTasks:listOwnerRepos',
  'zotzTasks:repoIssues',
  'zotzTasks:owners'
] as const

// Only the app's own windows may change connectors or their tokens.
function isWindowRenderer(event: IpcMainInvokeEvent): boolean {
  return !event.sender.isDestroyed() && event.sender.getType() === 'window'
}

function connectorId(value: unknown): string | null {
  return typeof value === 'string' && /^[\w:.-]{1,200}$/.test(value) ? value : null
}

function feedList(value: unknown): { id: string; url: string }[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.slice(0, 50).flatMap((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null || !('id' in entry) || !('url' in entry)) {
      return []
    }
    const id = connectorId(entry.id)
    const url = typeof entry.url === 'string' && entry.url.length <= 2048 ? entry.url : null
    return id && url ? [{ id, url }] : []
  })
}

async function importFromDialog(
  event: IpcMainInvokeEvent,
  service: ZotzTaskConnectorService
): Promise<ZotzTaskConnectorImportResult> {
  const window = BrowserWindow.fromWebContents(event.sender)
  const options: Electron.OpenDialogOptions = {
    properties: ['openFile'],
    filters: [{ name: 'zotz-tasks', extensions: ['json', 'yaml', 'yml', 'toml'] }]
  }
  const picked = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
  const path = picked.filePaths[0]
  if (picked.canceled || !path) {
    return { ok: false, error: 'canceled', canceled: true }
  }
  if ((await stat(path)).size > ZOTZ_TASKS_MAX_BYTES) {
    return { ok: false, error: 'The file is larger than 2 MB' }
  }
  return service.importDocument(await readFile(path, 'utf8'), zotzTasksFormatFromName(path))
}

function repoList(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter(
          (repo): repo is string => typeof repo === 'string' && /^[\w.-]+\/[\w.-]+$/.test(repo)
        )
        .slice(0, 100)
    : []
}

function issueRefs(value: unknown): { repo: string; number: number }[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.slice(0, 500).flatMap((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null || !('repo' in entry) || !('number' in entry)) {
      return []
    }
    const repo = repoList([entry.repo])[0]
    return repo && typeof entry.number === 'number' ? [{ repo, number: entry.number }] : []
  })
}

function shortText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 200 ? value : null
}

export function startZotzTaskConnectors(
  userDataPath: string,
  store: ZotzTaskSettingsStore
): () => void {
  const service = new ZotzTaskConnectorService(userDataPath)
  setActiveZotzTaskConnectors({
    service,
    store,
    notifyChanged: () => sendToTrustedUIRenderer('zotzTasks:changed', null)
  })
  ipcMain.handle('zotzTasks:snapshot', () => service.snapshot())
  ipcMain.handle('zotzTasks:refresh', (_event, connectors: unknown) =>
    service.refresh(feedList(connectors))
  )
  ipcMain.handle('zotzTasks:setToken', (event, id: unknown, token: unknown) => {
    const valid = connectorId(id)
    if (!isWindowRenderer(event) || !valid) {
      return false
    }
    const value = typeof token === 'string' && token.length <= 4096 ? token.trim() : null
    return service.setToken(valid, value || null)
  })
  ipcMain.handle('zotzTasks:importFile', (event) =>
    isWindowRenderer(event)
      ? importFromDialog(event, service)
      : { ok: false, error: 'Not allowed from this window' }
  )
  ipcMain.handle('zotzTasks:remove', (event, id: unknown) => {
    const valid = connectorId(id)
    if (isWindowRenderer(event) && valid) {
      return service.remove(valid)
    }
    return undefined
  })
  ipcMain.handle('zotzTasks:syncPullRequests', (_event, repos: unknown) =>
    service.syncPullRequests(repoList(repos))
  )
  ipcMain.handle('zotzTasks:move', (event, id: unknown, taskId: unknown, optionId: unknown) => {
    const valid = connectorId(id)
    const task = shortText(taskId)
    const option = shortText(optionId)
    return isWindowRenderer(event) && valid && task && option
      ? service.move(valid, task, option)
      : { ok: false, error: 'Not allowed' }
  })
  ipcMain.handle('zotzTasks:development', (_event, refs: unknown) =>
    fetchZotzIssueDevelopment(issueRefs(refs))
  )
  ipcMain.handle('zotzTasks:viewer', () => fetchZotzViewerLogin())
  ipcMain.handle('zotzTasks:listOwnerRepos', (_event, owner: unknown, ownerType: unknown) =>
    typeof owner === 'string' && (ownerType === 'organization' || ownerType === 'user')
      ? listZotzOwnerRepos(owner, ownerType)
      : { ok: false, error: 'Invalid owner' }
  )
  ipcMain.handle('zotzTasks:owners', () => listZotzOwners())
  ipcMain.handle('zotzTasks:repoIssues', (_event, repos: unknown) =>
    fetchZotzRepoIssues(repoList(repos))
  )
  ipcMain.handle(
    'zotzTasks:linkPullRequest',
    (event, id: unknown, taskId: unknown, url: unknown) => {
      const valid = connectorId(id)
      const task = shortText(taskId)
      const pullRequestUrl =
        typeof url === 'string' && /^https:\/\/[^/]+\/[\w.-]+\/[\w.-]+\/pull\/\d+$/.test(url)
          ? url
          : null
      return isWindowRenderer(event) && valid && task && pullRequestUrl
        ? service.linkPullRequest(valid, task, pullRequestUrl)
        : null
    }
  )
  return () => {
    setActiveZotzTaskConnectors(null)
    for (const channel of CHANNELS) {
      ipcMain.removeHandler(channel)
    }
  }
}
