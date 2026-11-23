import React, { useEffect, useState } from 'react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { TuiAgent } from '../../../../../shared/agent-launch/catalog/tui-agent'
import type { Repo } from '../../../../../shared/repository/repo-types'
import type { ZotzGroupStart } from './zotz-group-start'

export type ZotzGroupNameRequest = {
  /** Absent when creating a group. */
  groupId?: string
  current: string
  /** Projects a new group can start a conversation in; absent when renaming. */
  projects?: readonly Repo[]
  onSave: (name: string, start: ZotzGroupStart | null) => Promise<void>
}

const AGENTS: readonly { id: TuiAgent; label: string }[] = [
  { id: 'claude', label: 'Claude' },
  { id: 'codex', label: 'Codex' }
]

/** Names a new group (optionally starting a conversation per project on one task) or renames one. */
export function ZotzGroupNameDialog({
  request,
  onClose
}: {
  request: ZotzGroupNameRequest | null
  onClose: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const [value, setValue] = useState('')
  const [task, setTask] = useState('')
  const [agent, setAgent] = useState<TuiAgent>('claude')
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set())
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setValue(request?.current ?? '')
    setTask('')
    setChosen(new Set())
  }, [request])
  const name = value.trim()
  const creating = request?.groupId === undefined
  const projects = request?.projects ?? []
  const repos = projects.filter((repo) => chosen.has(repo.id))
  // Starting needs both a task and somewhere to run it; either alone is a half-filled form.
  const startIncomplete = repos.length > 0 !== (task.trim() !== '')
  const toggle = (id: string, on: boolean): void =>
    setChosen((prev) => {
      const next = new Set(prev)
      if (on) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })

  return (
    <Dialog open={request !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {creating
              ? t('zotz.groups.newTitle', 'New group')
              : t('zotz.groups.renameTitle', 'Rename group')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'zotz.groups.nameDescription',
              'A group joins conversations from any project to work on one task. Its agents can write to each other.'
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (!request || !name || startIncomplete) {
              return
            }
            setSaving(true)
            void request
              .onSave(name, repos.length > 0 ? { task: task.trim(), agent, repos } : null)
              .then(onClose)
              .finally(() => setSaving(false))
          }}
        >
          <Input
            autoFocus
            value={value}
            maxLength={80}
            placeholder={t('zotz.groups.namePlaceholder', 'Appointments feature')}
            onChange={(event) => setValue(event.target.value)}
            className="h-8"
          />
          {creating && projects.length > 0 ? (
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-muted-foreground">
                {t(
                  'zotz.groups.startLegend',
                  'Optional: start a conversation in each project with the same task'
                )}
              </legend>
              <div className="max-h-36 space-y-1 overflow-y-auto scrollbar-sleek">
                {projects.map((repo) => (
                  <label key={repo.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={chosen.has(repo.id)}
                      onCheckedChange={(checked) => toggle(repo.id, checked === true)}
                    />
                    <span className="truncate">{repo.displayName}</span>
                  </label>
                ))}
              </div>
              {repos.length > 0 ? (
                <>
                  <Textarea
                    value={task}
                    rows={4}
                    placeholder={t(
                      'zotz.groups.taskPlaceholder',
                      'What should they build together?'
                    )}
                    onChange={(event) => setTask(event.target.value)}
                  />
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={agent}
                    onValueChange={(next) => (next ? setAgent(next as TuiAgent) : undefined)}
                  >
                    {AGENTS.map((option) => (
                      <ToggleGroupItem key={option.id} value={option.id}>
                        {option.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </>
              ) : null}
            </fieldset>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t('zotz.shortName.cancel', 'Cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={saving || !name || startIncomplete}>
              {!creating
                ? t('zotz.shortName.save', 'Save')
                : repos.length > 0
                  ? t('zotz.groups.createAndStart', 'Create and start {{count}}', {
                      count: repos.length
                    })
                  : t('zotz.groups.create', 'Create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
