import { ipcMain } from 'electron'
import { sendToTrustedUIRenderer } from '../../ipc/ui'
import { readZotzTaskRelayConfig } from '../../../shared/zotz/tasks/zotz-task-relay-types'
import { isZotzTaskWindowRenderer } from './zotz-task-ipc-sender'
import { pushZotzTasksDocument, type ZotzTaskSettingsStore } from './zotz-task-connector-registry'
import { ZotzTaskRelayClient } from './zotz-task-relay-client'
import {
  onZotzRelayNoticesWantedChanged,
  publishZotzRelayNotices,
  setZotzRelayLive,
  zotzRelayNoticesWanted
} from './zotz-task-relay-notices'

const CHANNELS = [
  'zotzTasks:relayStatus',
  'zotzTasks:relayWatch',
  'zotzTasks:relaySetToken',
  'zotzTasks:relayCheck'
] as const

/** Optional relay (off by default): runs only once the user turns it on in Settings → Tasks. */
export function startZotzTaskRelay(userDataPath: string, store: ZotzTaskSettingsStore): () => void {
  const client = new ZotzTaskRelayClient({
    userDataPath,
    readConfig: () => readZotzTaskRelayConfig(store.getSettings().zotzTaskRelay),
    importDocument: pushZotzTasksDocument,
    publish: (update) => {
      setZotzRelayLive(update.status.state === 'live')
      sendToTrustedUIRenderer('zotzTasks:relay', update)
    },
    onNotices: publishZotzRelayNotices
  })
  // Windows with the board open; long-poll only while at least one is.
  const watchers = new Set<number>()
  const syncWatching = (): void => client.setWatching(watchers.size > 0 || zotzRelayNoticesWanted())
  const stopFlowWatch = onZotzRelayNoticesWantedChanged(syncWatching)

  ipcMain.handle('zotzTasks:relayStatus', () => client.getStatus())
  ipcMain.handle('zotzTasks:relayWatch', (event, active: unknown) => {
    const id = event.sender.id
    if (active === true && !watchers.has(id)) {
      watchers.add(id)
      event.sender.once('destroyed', () => {
        watchers.delete(id)
        syncWatching()
      })
    } else if (active !== true) {
      watchers.delete(id)
    }
    syncWatching()
  })
  ipcMain.handle('zotzTasks:relaySetToken', (event, token: unknown) => {
    if (!isZotzTaskWindowRenderer(event)) {
      return false
    }
    const value = typeof token === 'string' && token.length <= 512 ? token.trim() : ''
    return client.setToken(value || null)
  })
  ipcMain.handle('zotzTasks:relayCheck', (event, url: unknown) =>
    isZotzTaskWindowRenderer(event) &&
    typeof url === 'string' &&
    url.length <= 2048 &&
    /^https?:\/\//i.test(url)
      ? client.check(url)
      : { ok: false, error: 'Use an http:// or https:// URL' }
  )
  const stopSettings = store.onSettingsChanged((updates) => {
    if ('zotzTaskRelay' in updates) {
      client.restart()
    }
  })
  syncWatching()
  client.start()
  return () => {
    stopFlowWatch()
    setZotzRelayLive(false)
    stopSettings()
    client.stop()
    for (const channel of CHANNELS) {
      ipcMain.removeHandler(channel)
    }
  }
}
