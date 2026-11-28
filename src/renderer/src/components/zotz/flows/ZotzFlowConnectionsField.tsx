import React from 'react'
import { X } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { ZotzFlowDraft } from '../../../../../shared/zotz/flows/zotz-flow-contract'
import {
  getZotzFlowNodePorts,
  type ZotzFlowNode
} from '../../../../../shared/zotz/flows/zotz-flow-node-contract'
import { indexZotzFlowNodes, isZotzFlowDescendant } from './zotz-flow-canvas-geometry'
import { zotzFlowPortLabel } from './zotz-flow-node-copy'
import { ZotzFlowField, ZotzFlowSection } from './ZotzFlowFormParts'

const OUTSIDE = '__outside'

/** Keyboard path for what the canvas does by dragging: connect outputs and move into a loop. */
export function ZotzFlowConnectionsField({
  node,
  draft,
  onConnect,
  onDisconnect,
  onSetParent
}: {
  node: ZotzFlowNode
  draft: ZotzFlowDraft
  onConnect: (port: string, toId: string) => void
  onDisconnect: (edgeId: string) => void
  onSetParent: (parentId: string | undefined) => void
}): React.JSX.Element {
  const t = useTranslate()
  const byId = indexZotzFlowNodes(draft.nodes)
  const siblings = draft.nodes.filter(
    (other) => other.id !== node.id && other.parentId === node.parentId
  )
  const loops = draft.nodes.filter(
    (other) =>
      other.kind === 'for_each' &&
      other.id !== node.id &&
      !isZotzFlowDescendant(other, node.id, byId)
  )
  return (
    <ZotzFlowSection title={t('zotz.flows.connections', 'Connections')}>
      {getZotzFlowNodePorts(node).map((port) => {
        const outgoing = draft.edges.filter(
          (edge) => edge.from.nodeId === node.id && edge.from.port === port
        )
        const label = zotzFlowPortLabel(node, port, t) || t('zotz.flows.port.next', 'Next')
        const free = siblings.filter(
          (other) => !outgoing.some((edge) => edge.to.nodeId === other.id)
        )
        return (
          <div key={port} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            {outgoing.map((edge) => (
              <div
                key={edge.id}
                className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
                  {byId.get(edge.to.nodeId)?.name ?? edge.to.nodeId}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('zotz.flows.disconnect', 'Disconnect {name}').replace(
                    '{name}',
                    () => byId.get(edge.to.nodeId)?.name ?? ''
                  )}
                  onClick={() => onDisconnect(edge.id)}
                >
                  <X />
                </Button>
              </div>
            ))}
            {free.length > 0 ? (
              <Select value="" onValueChange={(toId) => onConnect(port, toId)}>
                <SelectTrigger
                  size="sm"
                  className="w-full"
                  aria-label={t('zotz.flows.connectPort', 'Connect {port} to').replace(
                    '{port}',
                    () => label
                  )}
                >
                  <SelectValue placeholder={t('zotz.flows.connectTo', 'Connect to…')} />
                </SelectTrigger>
                <SelectContent>
                  {free.map((other) => (
                    <SelectItem key={other.id} value={other.id}>
                      <span className="font-mono">{other.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        )
      })}
      {loops.length > 0 || node.parentId ? (
        <ZotzFlowField
          label={t('zotz.flows.insideLoop', 'Inside loop')}
          hint={t(
            'zotz.flows.insideLoopHint',
            'Moving a step in or out of a loop removes its connections.'
          )}
        >
          {(id, describedBy) => (
            <Select
              value={node.parentId ?? OUTSIDE}
              onValueChange={(value) => onSetParent(value === OUTSIDE ? undefined : value)}
            >
              <SelectTrigger id={id} aria-describedby={describedBy} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={OUTSIDE}>{t('zotz.flows.noLoop', 'No loop')}</SelectItem>
                {loops.map((loop) => (
                  <SelectItem key={loop.id} value={loop.id}>
                    <span className="font-mono">{loop.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </ZotzFlowField>
      ) : null}
    </ZotzFlowSection>
  )
}
