import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileUp, Plug, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import { SearchableSetting } from '../../settings/section-layout/SearchableSetting'
import { createNonSecureContextUuid } from '../../../../../shared/identifiers/non-secure-context-uuid'
import type { GlobalSettings } from '../../../../../shared/global-settings-types'
import {
  readZotzTaskConnectors,
  type ZotzTaskConnectorConfig,
  type ZotzTaskConnectorSnapshot
} from '../../../../../shared/zotz/tasks/zotz-task-connector-types'
import { hideBrokenImage } from './ZotzTaskCard'

export const ZOTZ_TASK_CONNECTORS_SECTION_ID = 'zotz-task-connectors'

/** Settings → Tasks: external services that publish tasks in the zotz-tasks/v1 format. */
export function ZotzTaskConnectorsSetting({
  settings,
  updateSettings
}: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}): React.JSX.Element | null {
  const t = useTranslate()
  const locale = useIntlLocale()
  const api = window.api?.zotzTaskConnectors
  const connectors = useMemo(
    () => readZotzTaskConnectors(settings.zotzTaskConnectors),
    [settings.zotzTaskConnectors]
  )
  const [snapshots, setSnapshots] = useState<ZotzTaskConnectorSnapshot[]>([])
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null)

  const reload = useCallback(() => {
    void api?.snapshot().then(setSnapshots, () => undefined)
  }, [api])
  useEffect(reload, [reload])

  if (!api) {
    return null
  }
  const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]))
  const save = (next: ZotzTaskConnectorConfig[]): void => {
    updateSettings({ zotzTaskConnectors: next })
  }
  const upsert = (connector: ZotzTaskConnectorConfig): void => {
    save([...connectors.filter((item) => item.id !== connector.id), connector])
  }

  const connect = async (): Promise<void> => {
    const feedUrl = url.trim()
    if (!/^https?:\/\//i.test(feedUrl)) {
      setMessage({
        tone: 'error',
        text: t('zotz.taskConnectors.badUrl', 'Use an http:// or https:// URL.')
      })
      return
    }
    setBusy(true)
    setMessage(null)
    const id = `feed-${createNonSecureContextUuid().slice(0, 8)}`
    try {
      if (token.trim() && !(await api.setToken(id, token.trim()))) {
        setMessage({
          tone: 'error',
          text: t(
            'zotz.taskConnectors.noEncryption',
            "This system can't encrypt the token, so it wasn't saved."
          )
        })
        return
      }
      const result = (await api.refresh([{ id, url: feedUrl }])).find((item) => item.id === id)
      setSnapshots(await api.snapshot())
      if (!result?.document) {
        await api.remove(id)
        setMessage({
          tone: 'error',
          text: result?.error ?? t('zotz.taskConnectors.failed', "Couldn't read that service.")
        })
        return
      }
      upsert({
        id,
        kind: 'url',
        url: feedUrl,
        name: result.document.source.name,
        hasToken: token.trim().length > 0
      })
      setUrl('')
      setToken('')
      setMessage({
        tone: 'ok',
        text: t('zotz.taskConnectors.connected', 'Connected {{name}}: {{total}} tasks.', {
          name: result.document.source.name,
          total: result.document.tasks.length
        })
      })
    } finally {
      setBusy(false)
    }
  }

  const importFile = async (): Promise<void> => {
    setMessage(null)
    const result = await api.importFile()
    if (result.ok) {
      upsert(result.connector)
      reload()
      setMessage({
        tone: 'ok',
        text: t('zotz.taskConnectors.connected', 'Connected {{name}}: {{total}} tasks.', {
          name: result.connector.name,
          total: result.snapshot.document?.tasks.length ?? 0
        })
      })
    } else if (!result.canceled) {
      setMessage({ tone: 'error', text: result.error })
    }
  }

  const refreshOne = async (connector: ZotzTaskConnectorConfig): Promise<void> => {
    if (connector.url) {
      setSnapshots(await api.refresh([{ id: connector.id, url: connector.url }]))
    }
  }
  const remove = async (connector: ZotzTaskConnectorConfig): Promise<void> => {
    await api.remove(connector.id)
    save(connectors.filter((item) => item.id !== connector.id))
    reload()
  }

  return (
    <SearchableSetting
      id={ZOTZ_TASK_CONNECTORS_SECTION_ID}
      title={t('zotz.taskConnectors.title', 'External task services')}
      description={t(
        'zotz.taskConnectors.description',
        'Connect a service that publishes tasks in the zotz-tasks/v1 format (JSON, YAML or TOML), by URL or from a file.'
      )}
      keywords={['zotz-tasks', 'feed', 'webhook', 'tickets', 'connector', 'conector']}
      className="flex flex-col gap-3 py-4"
    >
      <p className="text-sm font-medium">
        {t('zotz.taskConnectors.title', 'External task services')}
      </p>
      <p className="text-xs text-muted-foreground">
        {t(
          'zotz.taskConnectors.description',
          'Connect a service that publishes tasks in the zotz-tasks/v1 format (JSON, YAML or TOML), by URL or from a file.'
        )}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={t(
            'zotz.taskConnectors.urlPlaceholder',
            'https://tickets.example.com/zotz-tasks.json'
          )}
          className="h-8 min-w-64 flex-1"
        />
        <Input
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder={t('zotz.taskConnectors.tokenPlaceholder', 'Token (optional)')}
          className="h-8 w-44"
          autoComplete="off"
        />
        <Button
          type="button"
          size="sm"
          onClick={() => void connect()}
          disabled={busy || !url.trim()}
        >
          <Plug className="size-3.5" />
          {t('zotz.taskConnectors.connect', 'Connect')}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void importFile()}>
          <FileUp className="size-3.5" />
          {t('zotz.taskConnectors.importFile', 'Import file')}
        </Button>
      </div>
      {message ? (
        <p
          className={
            message.tone === 'error' ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'
          }
        >
          {message.text}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        {connectors.map((connector) => {
          const snapshot = byId.get(connector.id)
          const document = snapshot?.document
          return (
            <div
              key={connector.id}
              className="flex items-start gap-3 rounded-md border border-border/60 px-3 py-2"
            >
              {document?.source.logoUrl ? (
                <img
                  src={document.source.logoUrl}
                  alt=""
                  onError={hideBrokenImage}
                  className="mt-0.5 size-5 rounded-sm"
                />
              ) : (
                <Plug className="mt-0.5 size-5 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1 text-xs">
                <p className="truncate text-sm font-medium">
                  {document?.source.name ?? connector.name}
                </p>
                <p className="truncate text-muted-foreground">
                  {connector.kind === 'file'
                    ? t('zotz.taskConnectors.fromFile', 'Imported from a file')
                    : connector.url}
                  {connector.hasToken
                    ? ` · ${t('zotz.taskConnectors.withToken', 'with token')}`
                    : ''}
                </p>
                {document ? (
                  <p className="text-muted-foreground">
                    {t('zotz.taskConnectors.status', '{{total}} tasks · updated {{time}}', {
                      total: document.tasks.length,
                      time: snapshot?.fetchedAt
                        ? new Date(snapshot.fetchedAt).toLocaleString(locale)
                        : '—'
                    })}
                  </p>
                ) : null}
                {snapshot?.rejected.length ? (
                  <p className="text-muted-foreground">
                    {t(
                      'zotz.taskConnectors.rejected',
                      'Skipped tasks: {{total}}. First problem: {{reason}}',
                      {
                        total: snapshot.rejected.length,
                        reason: `${snapshot.rejected[0]?.id ?? `#${snapshot.rejected[0]?.index}`} → ${snapshot.rejected[0]?.reason}`
                      }
                    )}
                  </p>
                ) : null}
                {snapshot?.error ? <p className="text-destructive">{snapshot.error}</p> : null}
              </div>
              {connector.kind === 'url' ? (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  type="button"
                  aria-label={t('zotz.taskBoard.refresh', 'Refresh')}
                  title={t('zotz.taskBoard.refresh', 'Refresh')}
                  onClick={() => void refreshOne(connector)}
                >
                  <RefreshCw className="size-3.5" />
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="icon-xs"
                type="button"
                aria-label={t('zotz.taskConnectors.remove', 'Remove')}
                title={t('zotz.taskConnectors.remove', 'Remove')}
                onClick={() => void remove(connector)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          )
        })}
      </div>
    </SearchableSetting>
  )
}
