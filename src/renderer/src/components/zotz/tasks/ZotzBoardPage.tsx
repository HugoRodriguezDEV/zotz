import { useTranslate } from '@/i18n/use-translate'
import { ZotzTaskBoard } from './ZotzTaskBoard'

/** The task board as a full page, opened from the sidebar like Home. */
export default function ZotzBoardPage(): React.JSX.Element {
  const t = useTranslate()
  return (
    <main className="flex h-full min-h-0 flex-1 flex-col bg-background text-foreground">
      <header className="shrink-0 border-b border-border px-5 py-3 md:px-8">
        <h1 className="truncate text-sm font-semibold">{t('zotz.taskBoard.title', 'Tasks')}</h1>
        <p className="truncate text-xs text-muted-foreground">
          {t('zotz.taskBoard.description', 'Tasks from all your projects in one board.')}
        </p>
      </header>
      <div className="flex min-h-0 flex-1 flex-col px-5 py-3 md:px-8">
        <ZotzTaskBoard active />
      </div>
    </main>
  )
}
