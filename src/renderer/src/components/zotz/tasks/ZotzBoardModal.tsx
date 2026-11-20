import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isPairedWebClientWindow } from '@/app-shell/chrome/desktop-window-chrome'
import { useTranslate } from '@/i18n/use-translate'
import { ZotzAgentQueuePanel } from '../agent-queue/ZotzAgentQueuePanel'
import { ZotzTaskBoard } from './ZotzTaskBoard'
import { closeZotzBoard, setZotzBoardTab, useZotzBoardModal } from './zotz-board-modal-store'

/** One modal for the task board and the agent queue; the sidebar opens Tasks, the status bar Agents. */
export function ZotzBoardModal(): React.JSX.Element | null {
  const t = useTranslate()
  const { open, tab } = useZotzBoardModal()

  if (isPairedWebClientWindow()) {
    return null
  }

  const title =
    tab === 'tasks'
      ? t('zotz.taskBoard.title', 'Tasks')
      : t('zotz.agentQueue.board.title', 'Agent queue')
  const description =
    tab === 'tasks'
      ? t('zotz.taskBoard.description', 'Tasks from all your projects in one board.')
      : t(
          'zotz.agentQueue.board.description',
          'Agents start when they fit in memory; the rest wait their turn here.'
        )

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
        <Tabs
          value={tab}
          onValueChange={(value) => {
            if (value === 'tasks' || value === 'agents') {
              setZotzBoardTab(value)
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <TabsList variant="line" size="sm">
            <TabsTrigger value="tasks">{t('zotz.taskBoard.tab.tasks', 'Tasks')}</TabsTrigger>
            <TabsTrigger value="agents">{t('zotz.taskBoard.tab.agents', 'Agents')}</TabsTrigger>
          </TabsList>
          <TabsContent value="tasks">
            <ZotzTaskBoard active={open && tab === 'tasks'} />
          </TabsContent>
          <TabsContent value="agents">
            <ZotzAgentQueuePanel active={open && tab === 'agents'} onNavigate={closeZotzBoard} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
