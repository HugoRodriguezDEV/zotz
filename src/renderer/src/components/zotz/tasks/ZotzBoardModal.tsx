import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { isPairedWebClientWindow } from '@/app-shell/chrome/desktop-window-chrome'
import { useTranslate } from '@/i18n/use-translate'
import { ZotzTaskBoard } from './ZotzTaskBoard'
import { closeZotzBoard, useZotzBoardOpen } from './zotz-board-modal-store'

/** The task board; the agent queue keeps its own side panel from the status bar. */
export function ZotzBoardModal(): React.JSX.Element | null {
  const t = useTranslate()
  const open = useZotzBoardOpen()

  if (isPairedWebClientWindow()) {
    return null
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          closeZotzBoard()
        }
      }}
    >
      <DialogContent className="sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{t('zotz.taskBoard.title', 'Tasks')}</DialogTitle>
          <DialogDescription>
            {t('zotz.taskBoard.description', 'Tasks from all your projects in one board.')}
          </DialogDescription>
        </DialogHeader>
        <ZotzTaskBoard active={open} />
      </DialogContent>
    </Dialog>
  )
}
