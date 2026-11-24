import { webContents, type WebContents } from 'electron'

type Watchable<Snapshot> = {
  watch: (id: number) => Snapshot
  unwatch: (id: number) => void
  watcherIds: () => number[]
}

/**
 * Windows that asked a sampler to run: a reload, navigation or closed window releases its watch,
 * so nothing keeps sampling for a renderer that is gone.
 */
export function createZotzWindowWatchers<Snapshot>(channel: string, target: Watchable<Snapshot>) {
  const detachers = new Map<number, () => void>()
  const unwatch = (id: number): void => {
    detachers.get(id)?.()
    detachers.delete(id)
    target.unwatch(id)
  }
  return {
    watch(sender: WebContents): Snapshot {
      const id = sender.id
      if (!detachers.has(id)) {
        const onGone = (): void => unwatch(id)
        const onNavigation = (
          details: Electron.Event<Electron.WebContentsDidStartNavigationEventParams>
        ): void => {
          if (details.isMainFrame && !details.isSameDocument) {
            unwatch(id)
          }
        }
        sender.once('destroyed', onGone)
        sender.on('did-start-navigation', onNavigation)
        detachers.set(id, () => {
          if (!sender.isDestroyed()) {
            sender.off('destroyed', onGone)
            sender.off('did-start-navigation', onNavigation)
          }
        })
      }
      return target.watch(id)
    },
    unwatch,
    publish(payload: unknown): void {
      for (const id of target.watcherIds()) {
        const window = webContents.fromId(id)
        if (!window || window.isDestroyed()) {
          unwatch(id)
          continue
        }
        window.send(channel, payload)
      }
    },
    dispose(): void {
      for (const detach of detachers.values()) {
        detach()
      }
      detachers.clear()
    }
  }
}
