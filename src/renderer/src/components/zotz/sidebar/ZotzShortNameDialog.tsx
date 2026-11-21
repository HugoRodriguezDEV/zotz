import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslate, type Translate } from '@/i18n/use-translate'
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
import type { ExecutionHostId } from '../../../../../shared/execution-host'
import {
  defaultZotzShortName,
  normalizeZotzShortName
} from '../../../../../shared/zotz/zotz-short-name'
import { saveZotzShortName } from './zotz-short-name-store'

export type ZotzShortNameRequest = {
  hostId: ExecutionHostId
  path: string
  current: string
  /** False while it still follows the folder name. */
  isCustom: boolean
  /** Names other workspaces on the same machine already use. */
  taken: ReadonlySet<string>
}

/** True once the host kept the name; refusals and transport errors become a toast. */
async function saveShortName(
  request: ZotzShortNameRequest,
  shortName: string,
  t: Translate
): Promise<boolean> {
  try {
    const result = await saveZotzShortName(request.hostId, request.path, shortName)
    if (!result.ok) {
      toast.error(
        result.reason === 'taken'
          ? t('zotz.shortName.taken', 'Another conversation on this machine uses that name.')
          : t('zotz.shortName.invalid', 'Use letters, numbers or dashes.')
      )
    }
    return result.ok
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
    return false
  }
}

export function ZotzShortNameDialog({
  request,
  onClose
}: {
  request: ZotzShortNameRequest | null
  onClose: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setValue(request?.current ?? '')
  }, [request])

  const folderName = request ? defaultZotzShortName(request.path) : ''
  const normalized = normalizeZotzShortName(value)
  const effective = normalized || folderName
  const taken = request !== null && effective !== request.current && request.taken.has(effective)
  const invalid = value.trim() !== '' && normalized === ''

  const save = async (shortName: string): Promise<void> => {
    if (!request) {
      return
    }
    setSaving(true)
    const saved = await saveShortName(request, shortName, t)
    setSaving(false)
    if (saved) {
      onClose()
    }
  }

  return (
    <Dialog open={request !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('zotz.shortName.title', 'Short name')}</DialogTitle>
          <DialogDescription>
            {t(
              'zotz.shortName.description',
              'Agents use it to message this conversation. Unique on this machine; letters, numbers and dashes.'
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-1.5"
          onSubmit={(event) => {
            event.preventDefault()
            if (!taken && !invalid) {
              void save(value === folderName ? '' : value)
            }
          }}
        >
          <Input
            autoFocus
            value={value}
            placeholder={folderName}
            onChange={(event) => setValue(event.target.value)}
            variant="code"
            className="h-8"
          />
          <p className="min-h-4 text-xs text-muted-foreground">
            {invalid
              ? t('zotz.shortName.invalid', 'Use letters, numbers or dashes.')
              : taken
                ? t('zotz.shortName.taken', 'Another conversation on this machine uses that name.')
                : normalized && normalized !== value.trim()
                  ? t('zotz.shortName.preview', 'Saved as {{name}}', { name: normalized })
                  : null}
          </p>
          <DialogFooter>
            {request?.isCustom ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving}
                className="mr-auto"
                onClick={() => void save('')}
              >
                {t('zotz.shortName.useFolder', 'Use folder name')}
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t('zotz.shortName.cancel', 'Cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={saving || taken || invalid}>
              {t('zotz.shortName.save', 'Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
