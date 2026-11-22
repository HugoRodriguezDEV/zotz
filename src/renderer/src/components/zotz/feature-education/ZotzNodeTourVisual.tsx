import type React from 'react'
import { Check, Laptop, Server, Smartphone } from 'lucide-react'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import type { ZotzNodeSetupStepId } from '../../../../../shared/zotz/zotz-node-setup-contract'
import { zotzNodeSetupStepTitle } from '../zotz-node-setup-step-labels'
import { useZotzTourPhase } from './use-zotz-tour-phase'

const STEPS: readonly ZotzNodeSetupStepId[] = ['tailscale', 'keepAwake', 'autostart', 'firewall']
// One phase per checked step, then the laptop's task arrives at the server.
const PHASES = STEPS.length + 2

function Device({
  icon: Icon,
  label,
  sending
}: {
  icon: typeof Laptop
  label: string
  sending: boolean
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-card-foreground transition-colors',
        sending && 'border-primary'
      )}
    >
      <Icon className="size-4 text-muted-foreground" />
      {label}
    </div>
  )
}

/** Laptop and phone reach the always-on server over Tailscale once the server setup is done. */
export function ZotzNodeTourVisual({
  reducedMotion
}: {
  reducedMotion: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const phase = useZotzTourPhase(PHASES, 1300, reducedMotion)
  const checked = Math.min(phase, STEPS.length)
  const ready = phase >= STEPS.length
  const sent = phase === PHASES - 1
  return (
    <div className="flex w-full items-center gap-4" aria-hidden>
      <div className="flex shrink-0 flex-col gap-3">
        <Device
          icon={Laptop}
          label={t('zotz.tours.visual.node.laptop', 'Your laptop')}
          sending={sent}
        />
        <Device
          icon={Smartphone}
          label={t('zotz.tours.visual.node.phone', 'Your phone')}
          sending={false}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
            ready
              ? 'border-primary text-foreground'
              : 'border-dashed border-border text-muted-foreground'
          )}
        >
          {t('zotz.tours.visual.node.tailscale', 'Tailscale')}
        </span>
        <div className="relative h-px w-full bg-border">
          <span
            className={cn(
              'absolute -top-1 size-2 rounded-full bg-primary',
              !reducedMotion && 'transition-[left] duration-1000 ease-in-out',
              !ready && 'opacity-0'
            )}
            style={{ left: sent ? 'calc(100% - 0.5rem)' : 0 }}
          />
        </div>
        <span className="text-[11px] text-muted-foreground">
          {t('zotz.tours.visual.node.privateLink', 'Only your tailnet can reach it')}
        </span>
      </div>
      <div className="w-56 shrink-0 rounded-lg border border-border bg-card p-3 text-card-foreground">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
          <Server className="size-4 text-muted-foreground" />
          {t('zotz.tours.visual.node.server', 'Server · on 24/7')}
        </div>
        <ul className="space-y-1.5">
          {STEPS.map((id, index) => (
            <li key={id} className="flex items-center gap-2 text-[11px]">
              <span
                className={cn(
                  'flex size-3.5 shrink-0 items-center justify-center rounded-full border transition-colors',
                  index < checked
                    ? 'border-status-success bg-status-success text-background'
                    : 'border-border'
                )}
              >
                {index < checked ? <Check className="size-2.5" strokeWidth={3} /> : null}
              </span>
              <span className={index < checked ? 'text-foreground' : 'text-muted-foreground'}>
                {zotzNodeSetupStepTitle(id, t)}
              </span>
            </li>
          ))}
        </ul>
        <div
          className={cn(
            'mt-2.5 rounded-md bg-muted px-2 py-1.5 text-[11px] transition-opacity',
            sent ? 'opacity-100' : 'opacity-0'
          )}
        >
          {t('zotz.tours.visual.node.taskArrived', 'New conversation from your laptop: fix-ci')}
        </div>
      </div>
    </div>
  )
}
