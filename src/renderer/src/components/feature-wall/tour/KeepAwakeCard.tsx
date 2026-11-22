import { resolveZotzMachineMode } from '../../../../../shared/zotz/zotz-machine-mode'
import type { JSX } from 'react'
import { Switch } from '@/components/ui/switch'
import {
  getAgentAwakeDescription,
  getAgentAwakeTitle
} from '../../settings/agents/behavior/agent-awake-copy'
import type { GlobalSettings } from '../../../../../shared/global-settings-types'
import { useTranslate } from '@/i18n/use-translate'
import {
  computerAwakeSettingsForMode,
  normalizeComputerAwakeMode
} from '../../../../../shared/computer-awake-mode'

export function KeepAwakeCard(props: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}): JSX.Element {
  const t = useTranslate()
  const { settings, updateSettings } = props
  // A server never sleeps (Zotz machine mode), so the toggle there is informational.
  const serverMode = resolveZotzMachineMode(settings) === 'server'
  const enabled =
    serverMode ||
    normalizeComputerAwakeMode(
      settings.computerAwakeMode,
      settings.keepComputerAwakeWhileAgentsRun
    ) !== 'off'
  const title = getAgentAwakeTitle(t)
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 shrink space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[15px] font-semibold leading-tight text-foreground">{title}</div>
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {serverMode
                ? t('zotz.tours.featureWall.keepAwakeServer', 'Always on in server mode')
                : t('auto.components.feature.wall.KeepAwakeCard.209713d3c7', 'Optional')}
            </span>
          </div>
          <p className="text-[13px] leading-snug text-muted-foreground">
            {getAgentAwakeDescription(undefined, t)}
          </p>
        </div>
        <Switch
          aria-label={title}
          checked={enabled}
          disabled={serverMode}
          onCheckedChange={(checked) =>
            updateSettings(computerAwakeSettingsForMode(checked ? 'auto' : 'off'))
          }
        />
      </div>
    </div>
  )
}
