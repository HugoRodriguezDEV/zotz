import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTranslate } from '@/i18n/use-translate'
import { extractIpcErrorMessage } from '@/runtime/errors/ipc-error'
import { joinCreateProjectPath } from '@/components/sidebar/project-admission/create/create-project-defaults'
import { StepBackButton } from '@/components/new-workspace/project-location/SetProjectLocationForms'
import { createHostProjectFolder, resolveHostProjectsParent } from './zotz-host-folder-project'

/** Creates `<home>/zotz/projects/<name>` on a remote host and hands back its setup key. */
export function ZotzNewHostFolderForm({
  environmentId,
  onBack,
  onReady,
  resolveParent = resolveHostProjectsParent
}: {
  environmentId: string
  onBack: () => void
  onReady: (setupKey: string) => void
  resolveParent?: (environmentId: string) => Promise<string>
}): React.JSX.Element {
  const t = useTranslate()
  const [parentPath, setParentPath] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let current = true
    resolveParent(environmentId).then(
      (parent) => current && setParentPath(parent),
      (err) => current && setError(extractIpcErrorMessage(err, String(err)))
    )
    return () => {
      current = false
    }
  }, [environmentId, resolveParent])

  const trimmedName = name.trim()
  const submit = async (): Promise<void> => {
    if (!parentPath || !trimmedName) {
      return
    }
    setIsSubmitting(true)
    setError(null)
    const result = await createHostProjectFolder({ environmentId, parentPath, name: trimmedName })
    setIsSubmitting(false)
    if ('error' in result) {
      setError(result.error)
    } else if (result.setupKey) {
      onReady(result.setupKey)
    }
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <StepBackButton onBack={onBack} label={t('zotz.hostFolder.newFolder', 'New folder')} />
      <Input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t('zotz.hostFolder.namePlaceholder', 'Folder name')}
        className="h-9"
        spellCheck={false}
      />
      <p className="truncate font-mono text-xs text-muted-foreground">
        {parentPath
          ? joinCreateProjectPath(parentPath, trimmedName || '…')
          : t('zotz.hostFolder.resolvingParent', 'Finding the projects folder…')}
      </p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!parentPath || !trimmedName || isSubmitting}>
          {isSubmitting ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
          {t('zotz.hostFolder.create', 'Create folder')}
        </Button>
      </div>
    </form>
  )
}
