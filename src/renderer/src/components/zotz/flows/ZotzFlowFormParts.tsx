import React, { useId } from 'react'
import { cn } from '@/lib/class-names'
import { Label } from '@/components/ui/label'
import { AUTOMATION_EDITOR_SECTION_LABEL_CLASS } from '../../automations/automation-page-parts'

/** Labeled field; the child receives the id its control must use so the label names it. */
export function ZotzFlowField({
  label,
  hint,
  error,
  className,
  children
}: {
  label: React.ReactNode
  hint?: React.ReactNode
  error?: string | null
  className?: string
  children: (id: string, describedBy: string | undefined) => React.ReactNode
}): React.JSX.Element {
  const id = useId()
  const hintId = hint || error ? `${id}-hint` : undefined
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Label htmlFor={id} variant="settings">
        {label}
      </Label>
      {children(id, hintId)}
      {error ? (
        <p id={hintId} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function ZotzFlowSection({
  title,
  children,
  action
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-3 border-t border-border/60 px-4 py-4 first:border-t-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className={cn(AUTOMATION_EDITOR_SECTION_LABEL_CLASS, 'text-muted-foreground')}>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}
