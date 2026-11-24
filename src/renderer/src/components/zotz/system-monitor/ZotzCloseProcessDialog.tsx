import { useState } from 'react'
import { Loader2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { useTranslate, type Translate } from '@/i18n/use-translate'
import type {
  ZotzSystemProcessCloseResult,
  ZotzSystemProcessEntry
} from '../../../../../shared/zotz/system-monitor/zotz-system-monitor-contract'

type Step = 'confirm' | 'closing' | 'still-running' | 'forcing'

/** Why closing this one is risky; null for a target nobody in Zotz owns. */
export function zotzCloseWarning(
  target: ZotzSystemProcessEntry,
  workspaceName: (worktreeId: string | null) => string,
  t: Translate
): { text: string; severe: boolean } | null {
  const owner = target.owner
  if (!owner) {
    return null
  }
  switch (owner.kind) {
    case 'zotz':
      return {
        text: t(
          'zotz.systemMonitor.closeWarningZotz',
          'This is part of Zotz. Closing it can close the app, its terminals or its agents.'
        ),
        severe: true
      }
    case 'agent':
      return {
        text: owner.worktreeId
          ? t(
              'zotz.systemMonitor.closeWarningAgent',
              'This is the {{agent}} agent in {{workspace}}. Its work stops where it is.',
              { agent: owner.agent, workspace: workspaceName(owner.worktreeId) }
            )
          : t(
              'zotz.systemMonitor.closeWarningAgentNoWorkspace',
              'This is a running {{agent}} agent. Its work stops where it is.',
              { agent: owner.agent }
            ),
        severe: true
      }
    case 'zotz-child':
      return {
        text: t(
          'zotz.systemMonitor.closeWarningTerminal',
          'Zotz started it, in a terminal or as a tool.'
        ),
        severe: false
      }
  }
}

function failureMessage(
  result: Extract<ZotzSystemProcessCloseResult, { ok: false }>,
  t: Translate
): string {
  switch (result.reason) {
    case 'gone':
      return t('zotz.systemMonitor.closeGone', 'It had already closed.')
    case 'changed':
      return t(
        'zotz.systemMonitor.closeChanged',
        'That PID now belongs to another program. Nothing was closed.'
      )
    case 'protected':
      return t('zotz.systemMonitor.closeProtected', 'Zotz does not close system processes.')
    case 'not_permitted':
      return t(
        'zotz.systemMonitor.closeNotPermitted',
        'The system did not allow it: it belongs to another user or is protected.'
      )
    case 'failed':
      return t('zotz.systemMonitor.closeFailed', 'It could not be closed.')
  }
}

/** Asks first, closes politely, and only then offers to force it (docs/zotz/SPEC-monitor-y-remotos.md §A.3). */
export function ZotzCloseProcessDialog({
  target,
  workspaceName,
  onDone
}: {
  target: ZotzSystemProcessEntry | null
  workspaceName: (worktreeId: string | null) => string
  /** Called when the dialog closes; `closed` when the target exited. */
  onDone: (closed: boolean) => void
}): React.JSX.Element {
  const t = useTranslate()
  const [step, setStep] = useState<Step>('confirm')
  const close = (closed: boolean): void => {
    setStep('confirm')
    onDone(closed)
  }
  const run = async (force: boolean): Promise<void> => {
    if (!target) {
      return
    }
    setStep(force ? 'forcing' : 'closing')
    const result = (await window.api?.zotzSystemMonitor?.closeProcess({
      pid: target.pid,
      name: target.name,
      force
    })) ?? { ok: false, reason: 'failed' }
    if (result.ok && result.exited) {
      toast.success(t('zotz.systemMonitor.closed', '{{name}} closed', { name: target.name }))
      close(true)
      return
    }
    if (result.ok) {
      setStep('still-running')
      return
    }
    toast.error(failureMessage(result, t))
    close(false)
  }
  const warning = target ? zotzCloseWarning(target, workspaceName, t) : null
  const busy = step === 'closing' || step === 'forcing'
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => (open || busy ? undefined : close(false))}
    >
      {target ? (
        <DialogContent size="compact" data-zotz-close-process-dialog="">
          <DialogHeader>
            <DialogTitle>
              {step === 'still-running'
                ? t('zotz.systemMonitor.closeStillRunningTitle', '{{name}} is still open', {
                    name: target.name
                  })
                : t('zotz.systemMonitor.closeTitle', 'Close {{name}} ({{pid}})?', {
                    name: target.name,
                    pid: target.pid
                  })}
            </DialogTitle>
            <DialogDescription>
              {step === 'still-running'
                ? t(
                    'zotz.systemMonitor.closeStillRunning',
                    'It did not close when asked. Forcing it ends it at once, without letting it save anything.'
                  )
                : t(
                    'zotz.systemMonitor.closeExplain',
                    'Zotz asks it to close first, so it can save; if it does not, you can force it.'
                  )}
            </DialogDescription>
          </DialogHeader>
          {warning ? (
            <p
              className={
                warning.severe
                  ? 'flex gap-2 text-sm text-destructive'
                  : 'text-sm text-muted-foreground'
              }
            >
              {warning.severe ? <TriangleAlert className="mt-0.5 size-4 shrink-0" /> : null}
              {warning.text}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => close(false)}
            >
              {t('zotz.systemMonitor.closeCancel', 'Cancel')}
            </Button>
            {step === 'still-running' || step === 'forcing' ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() => void run(true)}
              >
                {step === 'forcing' ? <Loader2 className="size-4 animate-spin" /> : null}
                {t('zotz.systemMonitor.forceClose', 'Force close')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() => void run(false)}
              >
                {step === 'closing' ? <Loader2 className="size-4 animate-spin" /> : null}
                {t('zotz.systemMonitor.closeProcess', 'Close process')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
