import React from 'react'
import { Panel, useReactFlow } from '@xyflow/react'
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function ControlButton({
  label,
  onClick,
  children
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/** Zoom in, zoom out and fit everything; fit ignores the readable minimum because it is asked for. */
export function ZotzFlowZoomControls({ onFitAll }: { onFitAll: () => void }): React.JSX.Element {
  const t = useTranslate()
  const flow = useReactFlow()
  return (
    <Panel position="bottom-left">
      <div className="flex gap-1">
        <ControlButton label={t('zotz.flows.zoomIn', 'Zoom in')} onClick={() => void flow.zoomIn()}>
          <ZoomIn />
        </ControlButton>
        <ControlButton
          label={t('zotz.flows.zoomOut', 'Zoom out')}
          onClick={() => void flow.zoomOut()}
        >
          <ZoomOut />
        </ControlButton>
        <ControlButton label={t('zotz.flows.fitView', 'Fit to view')} onClick={onFitAll}>
          <Maximize />
        </ControlButton>
      </div>
    </Panel>
  )
}
