import { Notification } from 'electron'
import type { NotificationSettings } from '../../../shared/notification-settings-types'
import { deliverNativeNotification } from '../../ipc/native-notification-delivery'

/**
 * Notify step: a Zotz notice on this machine only (Hugo's v1 decision, spec §2.5). A headless
 * server has no desktop, so the notice stays in the step output for the run view.
 */
export async function notifyZotzFlow(
  settings: NotificationSettings | undefined,
  request: { title: string; body: string; runId: string; nodeKey: string }
): Promise<void> {
  if (!settings?.enabled || !Notification.isSupported()) {
    return
  }
  await deliverNativeNotification(
    {
      source: 'agent-task-complete',
      notificationId: `zotz-flow:${request.runId}:${request.nodeKey}`
    },
    { title: request.title, body: request.body },
    settings
  )
}
