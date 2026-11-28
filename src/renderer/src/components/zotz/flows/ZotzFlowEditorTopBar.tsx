import React from 'react'
import { LayoutGrid, Loader2, Play, Redo2, Save, Undo2 } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { HostCombobox, type HostComboboxOption } from '@/components/host-picker/HostCombobox'

function IconAction({
  label,
  disabled,
  onClick,
  children
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function ZotzFlowEditorTopBar({
  name,
  onNameChange,
  hostId,
  hosts,
  hostLocked,
  onHostChange,
  enabled,
  onEnabledChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAutoLayout,
  errorCount,
  dirty,
  saving,
  running,
  onSave,
  onRun,
  leading,
  trailing
}: {
  name: string
  onNameChange: (name: string) => void
  hostId: string
  hosts: readonly HostComboboxOption[]
  hostLocked: boolean
  onHostChange: (hostId: string) => void
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onAutoLayout: () => void
  errorCount: number
  dirty: boolean
  saving: boolean
  running: boolean
  onSave: () => void
  onRun: () => void
  /** Panel toggles at each end of the bar. */
  leading?: React.ReactNode
  trailing?: React.ReactNode
}): React.JSX.Element {
  const t = useTranslate()
  const blocked = errorCount > 0
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
      {leading}
      <Input
        value={name}
        aria-label={t('zotz.flows.flowName', 'Flow name')}
        className="h-9 w-64"
        onChange={(event) => onNameChange(event.target.value)}
      />
      <HostCombobox
        value={hostId}
        options={hosts}
        disabled={hostLocked}
        ariaLabel={t('zotz.flows.machine', 'Machine')}
        className="w-48"
        onChange={onHostChange}
      />
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
        {t('zotz.flows.enabled', 'On')}
      </label>
      <div className="ml-auto flex items-center gap-1">
        <IconAction label={t('zotz.flows.undo', 'Undo')} disabled={!canUndo} onClick={onUndo}>
          <Undo2 />
        </IconAction>
        <IconAction label={t('zotz.flows.redo', 'Redo')} disabled={!canRedo} onClick={onRedo}>
          <Redo2 />
        </IconAction>
        <IconAction label={t('zotz.flows.autoLayout', 'Tidy up')} onClick={onAutoLayout}>
          <LayoutGrid />
        </IconAction>
      </div>
      {blocked ? (
        <span className="text-sm text-destructive">
          {t('zotz.flows.saveBlocked', 'Fix {count} errors to save').replace(
            '{count}',
            String(errorCount)
          )}
        </span>
      ) : dirty ? (
        <span className="text-sm text-muted-foreground">
          {t('zotz.flows.unsaved', 'Unsaved changes')}
        </span>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        disabled={blocked || saving || running}
        onClick={onRun}
      >
        {running ? <Loader2 className="size-4 animate-spin" /> : <Play />}
        {dirty ? t('zotz.flows.saveAndRun', 'Save and run') : t('zotz.flows.runNow', 'Run')}
      </Button>
      <Button type="button" disabled={blocked || saving || !dirty} onClick={onSave}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save />}
        {t('zotz.flows.save', 'Save')}
      </Button>
      {trailing}
    </div>
  )
}
