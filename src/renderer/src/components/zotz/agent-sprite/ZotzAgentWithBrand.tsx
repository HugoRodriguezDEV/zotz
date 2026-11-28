import type React from 'react'
import { AgentTypeIcon } from '@/components/agent/icons/agent-type-icon'
import type { AgentType } from '../../../../../shared/agent-status/contracts/agent-status-types'

/** A row's pixel agent with the logo of the model running in that chat just below it. */
export function ZotzAgentWithBrand({
  agentType,
  children
}: {
  agentType: AgentType | null | undefined
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <span className="flex shrink-0 flex-col items-center gap-0.5">
      {children}
      {agentType ? <AgentTypeIcon agentType={agentType} size={10} className="opacity-80" /> : null}
    </span>
  )
}
