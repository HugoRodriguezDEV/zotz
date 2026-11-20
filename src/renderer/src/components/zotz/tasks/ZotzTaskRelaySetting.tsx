import { useEffect, useState } from 'react'
import { Radio, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { SearchableSetting } from '../../settings/section-layout/SearchableSetting'
import type { GlobalSettings } from '../../../../../shared/global-settings-types'
import {
  readZotzTaskRelayConfig,
  ZOTZ_TASK_RELAY_OFF,
  type ZotzTaskRelayStatus
} from '../../../../../shared/zotz/tasks/zotz-task-relay-types'

export const ZOTZ_TASK_RELAY_SECTION_ID = 'zotz-task-relay'

/**
 * Settings → Tasks: the optional zotz-relay (off by default). It is the user's own service; Zotz
 * only makes outgoing calls to it, with a device token kept encrypted in main.
 */
export function ZotzTaskRelaySetting({
  settings,
  updateSettings
}: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}): React.JSX.Element | null {
  const t = useTranslate()
  const locale = useIntlLocale()
  const api = window.api?.zotzTaskConnectors
  const config = readZotzTaskRelayConfig(settings.zotzTaskRelay)
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<ZotzTaskRelayStatus>(ZOTZ_TASK_RELAY_OFF)

  useEffect(() => {
    if (!api?.onRelay) {
      return
    }
    void api.relayStatus().then(
      (value) => (value?.state ? setStatus(value) : undefined),
      () => undefined
    )
    return api.onRelay((update) => setStatus(update.status))
  }, [api])

  if (!api?.relayCheck) {
    return null
  }

  const connect = async (): Promise<void> => {
    const relayUrl = url.trim().replace(/\/+$/, '')
    if (!/^https?:\/\//i.test(relayUrl)) {
      setError(t('zotz.taskConnectors.badUrl', 'Use an http:// or https:// URL.'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (!(await api.relaySetToken(token.trim()))) {
        setError(
          t(
            'zotz.taskConnectors.noEncryption',
            "This system can't encrypt the token, so it wasn't saved."
          )
        )
        return
      }
      const check = await api.relayCheck(relayUrl)
      if (!check?.ok) {
        await api.relaySetToken(null)
        setError(check?.error ?? t('zotz.taskRelay.unreachable', "Couldn't reach the relay."))
        return
      }
      updateSettings({ zotzTaskRelay: { url: relayUrl, enabled: true, hasToken: true } })
      setUrl('')
      setToken('')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (): Promise<void> => {
    await api.relaySetToken(null)
    updateSettings({ zotzTaskRelay: undefined })
  }

  const statusText =
    status.state === 'live'
      ? t('zotz.taskRelay.statusLive', 'Live · checked {{time}}', {
          time: status.checkedAt ? new Date(status.checkedAt).toLocaleTimeString(locale) : '—'
        })
      : status.state === 'failing'
        ? t(
            'zotz.taskRelay.statusFailing',
            'Not answering: {{error}}. Checking GitHub every 5 min.',
            {
              error: status.error ?? '—'
            }
          )
        : t('zotz.taskRelay.statusOff', 'Off')

  return (
    <SearchableSetting
      id={ZOTZ_TASK_RELAY_SECTION_ID}
      title={t('zotz.taskRelay.title', 'Relay for instant updates')}
      description={t(
        'zotz.taskRelay.description',
        'Optional. Your own zotz-relay receives GitHub webhooks and pushes from task services; Zotz picks them up with outgoing calls only. Off by default.'
      )}
      keywords={['relay', 'webhook', 'github app', 'vercel', 'push', 'tiempo real']}
      className="flex flex-col gap-3 py-4"
    >
      <p className="text-sm font-medium">
        {t('zotz.taskRelay.title', 'Relay for instant updates')}
      </p>
      <p className="text-xs text-muted-foreground">
        {t(
          'zotz.taskRelay.description',
          'Optional. Your own zotz-relay receives GitHub webhooks and pushes from task services; Zotz picks them up with outgoing calls only. Off by default.'
        )}
      </p>

      {config ? (
        <div className="flex items-start gap-3 rounded-md border border-border/60 px-3 py-2">
          <Radio className="mt-0.5 size-5 text-muted-foreground" />
          <div className="min-w-0 flex-1 text-xs">
            <p className="truncate text-sm font-medium">{config.url}</p>
            <p
              className={cn(
                status.state === 'failing' ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {config.enabled ? statusText : t('zotz.taskRelay.statusOff', 'Off')}
            </p>
          </div>
          <Switch
            checked={config.enabled}
            aria-label={t('zotz.taskRelay.toggle', 'Use the relay')}
            onCheckedChange={(enabled) => updateSettings({ zotzTaskRelay: { ...config, enabled } })}
          />
          <Button
            variant="ghost"
            size="icon-xs"
            type="button"
            aria-label={t('zotz.taskConnectors.remove', 'Remove')}
            title={t('zotz.taskConnectors.remove', 'Remove')}
            onClick={() => void remove()}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={t('zotz.taskRelay.urlPlaceholder', 'https://zotz-relay.vercel.app')}
            className="h-8 min-w-64 flex-1"
          />
          <Input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder={t('zotz.taskRelay.tokenPlaceholder', 'Device token')}
            className="h-8 w-44"
            autoComplete="off"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => void connect()}
            disabled={busy || !url.trim() || !token.trim()}
          >
            {t('zotz.taskConnectors.connect', 'Connect')}
          </Button>
        </div>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </SearchableSetting>
  )
}
