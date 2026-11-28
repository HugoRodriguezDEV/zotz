import React from 'react'
import { ArrowLeft } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import type { ZotzFlowNodeKind } from '../../../../../shared/zotz/flows/zotz-flow-node-contract'
import { ZOTZ_FLOW_NODE_KINDS, ZOTZ_FLOW_PALETTE_KINDS } from './zotz-flow-node-catalog'
import { ZOTZ_FLOW_DRAG_MIME } from './ZotzFlowCanvas'

/** Drag a step onto the canvas, or press it to add it after the selected step. */
export function ZotzFlowNodePalette({
  onAdd,
  onBack
}: {
  onAdd: (kind: ZotzFlowNodeKind) => void
  onBack?: () => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-border bg-card">
      {onBack ? (
        <div className="border-b border-border px-2 py-2">
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft />
            {t('zotz.flows.allFlows', 'All flows')}
          </Button>
        </div>
      ) : null}
      <div className="px-4 pt-3 pb-1">
        <h2 className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
          {t('zotz.flows.palette', 'Steps')}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t(
            'zotz.flows.paletteHint',
            'Drag onto the canvas, or press to add after the selected step.'
          )}
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2 scrollbar-sleek">
        {ZOTZ_FLOW_PALETTE_KINDS.map((kind) => {
          const info = ZOTZ_FLOW_NODE_KINDS[kind]
          const Icon = info.icon
          return (
            <button
              key={kind}
              type="button"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(ZOTZ_FLOW_DRAG_MIME, kind)
                event.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => onAdd(kind)}
              className="flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              {t(...info.copy)}
            </button>
          )
        })}
      </div>
    </aside>
  )
}
