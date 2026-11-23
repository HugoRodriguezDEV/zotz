import React, { useEffect, useState } from 'react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

export type ZotzGroupNameRequest = {
  /** Absent when creating a group. */
  groupId?: string
  current: string
  onSave: (name: string) => Promise<void>
}

/** Names a new group or renames one. */
export function ZotzGroupNameDialog({
  request,
  onClose
}: {
  request: ZotzGroupNameRequest | null
  onClose: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setValue(request?.current ?? '')
  }, [request])
  const name = value.trim()
  const creating = request?.groupId === undefined

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
            if (!request || !name) {
              return
            }
            setSaving(true)
            void request
              .onSave(name)
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
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t('zotz.shortName.cancel', 'Cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={saving || !name}>
              {creating ? t('zotz.groups.create', 'Create') : t('zotz.shortName.save', 'Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
