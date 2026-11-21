import { Kanban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { isPairedWebClientWindow } from '@/app-shell/chrome/desktop-window-chrome'
import { useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store/index'
import { isZotzAutomatedLaunch } from '../zotz-machine-mode-wizard-event'
import { isZotzConductorSidebar } from '../../../../../shared/zotz/zotz-sidebar-layout'
import { toggleZotzBoard, useZotzBoardOpen } from './zotz-board-page-store'

/** Task board entry for Orca's sidebar; the simple sidebar has it under Home instead. */
export function ZotzBoardToolbarButton(): React.JSX.Element | null {
  const t = useTranslate()
  const active = useZotzBoardOpen()
  const conductor = useAppStore((s) => isZotzConductorSidebar(s.settings, isZotzAutomatedLaunch()))

  if (conductor || isPairedWebClientWindow()) {
    return null
  }

  const label = t('zotz.taskBoard.toolbar', 'Task board')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? 'secondary' : 'ghost'}
          size="icon-xs"
          type="button"
          aria-label={label}
          aria-pressed={active}
          onClick={toggleZotzBoard}
          className="text-muted-foreground"
        >
          <Kanban className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
