import type { IpcMainInvokeEvent } from 'electron'

/** Only the app's own windows may change task connectors, the relay or their tokens. */
export function isZotzTaskWindowRenderer(event: IpcMainInvokeEvent): boolean {
  return !event.sender.isDestroyed() && event.sender.getType() === 'window'
}
