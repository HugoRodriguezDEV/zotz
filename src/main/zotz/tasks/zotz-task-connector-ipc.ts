import { readFile, stat } from 'node:fs/promises'
import { BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { ZOTZ_TASKS_MAX_BYTES } from '../../../shared/zotz/tasks/zotz-tasks-contract'
import type { ZotzTaskConnectorImportResult } from '../../../shared/zotz/tasks/zotz-task-connector-types'
import { formatFromName, ZotzTaskConnectorService } from './zotz-task-connector-service'

const CHANNELS = [
  'zotzTasks:snapshot',
  'zotzTasks:refresh',
  'zotzTasks:setToken',
  'zotzTasks:importFile',
  'zotzTasks:remove'
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
  return service.importDocument(await readFile(path, 'utf8'), formatFromName(path))
}

export function startZotzTaskConnectors(userDataPath: string): () => void {
  const service = new ZotzTaskConnectorService(userDataPath)
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
  return () => {
    for (const channel of CHANNELS) {
      ipcMain.removeHandler(channel)
    }
  }
}
