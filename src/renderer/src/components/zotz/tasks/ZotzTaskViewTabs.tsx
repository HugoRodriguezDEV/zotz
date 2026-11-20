import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import type { ZotzTaskBoardViewsState } from './use-zotz-task-board-views'

/** Saved views as tabs: double-click renames, + saves the current setup as a new view. */
export function ZotzTaskViewTabs({ state }: { state: ZotzTaskBoardViewsState }): React.JSX.Element {
  const t = useTranslate()
  const [renaming, setRenaming] = useState<string | null>(null)
  const [name, setName] = useState('')

  const finishRename = (): void => {
    if (renaming) {
      state.rename(renaming, name)
    }
    setRenaming(null)
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {state.views.map((view) =>
        renaming === view.id ? (
          <Input
            key={view.id}
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={finishRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                finishRename()
              } else if (event.key === 'Escape') {
                setRenaming(null)
              }
            }}
            className="h-7 w-36"
          />
        ) : (
          <div
            key={view.id}
            className={cn(
              'flex items-center rounded-md border text-xs',
              view.id === state.view.id
                ? 'border-border bg-accent text-foreground'
                : 'border-transparent text-muted-foreground hover:bg-accent/60'
            )}
          >
            <button
              type="button"
              className="cursor-pointer px-2 py-1"
              onClick={() => state.select(view.id)}
              onDoubleClick={() => {
                setRenaming(view.id)
                setName(view.name)
              }}
              title={t('zotz.taskBoard.views.renameHint', 'Double-click to rename')}
            >
              {view.id === 'all' && view.name === 'All'
                ? t('zotz.taskBoard.views.all', 'All')
                : view.name}
              {view.id === state.view.id && state.dirty ? (
                <span aria-hidden className="ml-1 inline-block size-1.5 rounded-full bg-primary" />
              ) : null}
            </button>
            {view.id === state.view.id && state.views.length > 1 ? (
              <button
                type="button"
                aria-label={t('zotz.taskBoard.views.delete', 'Delete view')}
                title={t('zotz.taskBoard.views.delete', 'Delete view')}
                className="cursor-pointer pr-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => state.remove(view.id)}
              >
                <X className="size-3" />
              </button>
            ) : null}
          </div>
        )
      )}
      <Button
        variant="ghost"
        size="icon-xs"
        type="button"
        aria-label={t('zotz.taskBoard.views.new', 'New view')}
        title={t('zotz.taskBoard.views.new', 'New view')}
        onClick={() =>
          state.create(
            t('zotz.taskBoard.views.defaultName', 'View {{number}}', {
              number: state.views.length + 1
            })
          )
        }
      >
        <Plus className="size-3.5" />
      </Button>
      {state.dirty ? (
        <div className="ml-1 flex items-center gap-1">
          <Button type="button" size="xs" onClick={state.save}>
            {t('zotz.taskBoard.views.save', 'Save view')}
          </Button>
          <Button type="button" size="xs" variant="ghost" onClick={state.discard}>
            {t('zotz.taskBoard.views.discard', 'Discard')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
