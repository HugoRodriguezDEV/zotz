import React from 'react'
import { Copy, RefreshCw } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { getAgentCatalog } from '@/lib/agent-catalog/agent-catalog'
import {
  ZOTZ_FLOW_AGENT_OUTCOMES,
  ZOTZ_FLOW_PR_ACTIONS,
  type ZotzFlowAgentOutcome,
  type ZotzFlowTrigger
} from '../../../../../shared/zotz/flows/zotz-flow-trigger-contract'
import { createZotzFlowTrigger } from './zotz-flow-trigger-catalog'
import { ZotzFlowField } from './ZotzFlowFormParts'
import { ZotzFlowTriggerInputsField } from './ZotzFlowTriggerInputsField'
import { ZotzFlowScheduleTriggerFields } from './ZotzFlowScheduleTriggerFields'

type Patch = (trigger: ZotzFlowTrigger) => void

function toggle<T>(list: readonly T[], value: T, on: boolean): T[] {
  return on ? [...new Set([...list, value])] : list.filter((item) => item !== value)
}

function FilterInput({
  label,
  value,
  onChange
}: {
  label: string
  value: string | undefined
  onChange: (value: string | undefined) => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <ZotzFlowField label={label}>
      {(id) => (
        <Input
          id={id}
          value={value ?? ''}
          placeholder={t('zotz.flows.trigger.any', 'Any')}
          onChange={(event) => onChange(event.target.value.trim() ? event.target.value : undefined)}
        />
      )}
    </ZotzFlowField>
  )
}

function CheckRow({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}): React.JSX.Element {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      {label}
    </label>
  )
}

const OUTCOME_COPY: Record<ZotzFlowAgentOutcome, readonly [string, string]> = {
  success: ['zotz.flows.trigger.outcomeSuccess', 'Succeeded'],
  ['error' satisfies ZotzFlowAgentOutcome]: ['zotz.flows.trigger.outcomeError', 'Failed'],
  interrupted: ['zotz.flows.trigger.outcomeInterrupted', 'Interrupted']
}
const PR_COPY = {
  opened: ['zotz.flows.trigger.prOpened', 'Opened'],
  merged: ['zotz.flows.trigger.prMerged', 'Merged']
} as const

export function ZotzFlowTriggerFields({
  trigger,
  onChange
}: {
  trigger: ZotzFlowTrigger
  onChange: Patch
}): React.JSX.Element {
  const t = useTranslate()
  switch (trigger.kind) {
    case 'manual':
    case 'flow_call':
      return (
        <ZotzFlowTriggerInputsField
          inputs={trigger.inputs}
          onChange={(inputs) => onChange({ ...trigger, inputs })}
        />
      )
    case 'chat_command': {
      const context = trigger.context
      const setContext = (patch: Partial<typeof context>): void =>
        onChange({ ...trigger, context: { ...context, ...patch } })
      return (
        <>
          <ZotzFlowField
            label={t('zotz.flows.trigger.command', 'Own shortcut (optional)')}
            hint={t(
              'zotz.flows.trigger.commandHint',
              'Without one, run it with /flow and the flow name.'
            )}
          >
            {(id, describedBy) => (
              <div className="flex items-center gap-1">
                <span className="font-mono text-sm text-muted-foreground">/</span>
                <Input
                  variant="code"
                  id={id}
                  aria-describedby={describedBy}
                  value={trigger.command ?? ''}
                  onChange={(event) =>
                    onChange({ ...trigger, command: event.target.value.trim() || undefined })
                  }
                />
              </div>
            )}
          </ZotzFlowField>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {t('zotz.flows.trigger.context', 'What the chat sends')}
            </span>
            <CheckRow
              label={t('zotz.flows.trigger.ctxLastAnswer', "The agent's last answer")}
              checked={context.lastAnswer}
              onChange={(lastAnswer) => setContext({ lastAnswer })}
            />
            <CheckRow
              label={t('zotz.flows.trigger.ctxTranscript', 'Recent messages')}
              checked={context.transcript}
              onChange={(transcript) => setContext({ transcript })}
            />
            {context.transcript ? (
              <ZotzFlowField
                label={t('zotz.flows.trigger.ctxMessages', 'How many messages')}
                className="pl-6"
              >
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min={1}
                    max={200}
                    value={context.transcriptMessages}
                    onChange={(event) =>
                      setContext({
                        transcriptMessages: Math.min(
                          200,
                          Math.max(1, Math.round(Number(event.target.value) || 1))
                        )
                      })
                    }
                  />
                )}
              </ZotzFlowField>
            ) : null}
            <CheckRow
              label={t('zotz.flows.trigger.ctxAttachments', 'Attached files')}
              checked={context.attachments}
              onChange={(attachments) => setContext({ attachments })}
            />
            <CheckRow
              label={t('zotz.flows.trigger.ctxSession', 'Workspace, repo, branch and agent')}
              checked={context.session}
              onChange={(session) => setContext({ session })}
            />
          </div>
          <ZotzFlowTriggerInputsField
            inputs={trigger.inputs}
            onChange={(inputs) => onChange({ ...trigger, inputs })}
          />
        </>
      )
    }
    case 'schedule':
      return (
        <ZotzFlowScheduleTriggerFields key={trigger.id} trigger={trigger} onChange={onChange} />
      )
    case 'agent_finished':
      return (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {t('zotz.flows.trigger.agents', 'Agents (none checked: any)')}
            </span>
            {getAgentCatalog().map((agent) => (
              <CheckRow
                key={agent.id}
                label={agent.label}
                checked={trigger.agents.includes(agent.id)}
                onChange={(on) =>
                  onChange({ ...trigger, agents: toggle(trigger.agents, agent.id, on) })
                }
              />
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {t('zotz.flows.trigger.outcomes', 'Result (none checked: any)')}
            </span>
            {ZOTZ_FLOW_AGENT_OUTCOMES.map((outcome) => (
              <CheckRow
                key={outcome}
                label={t(OUTCOME_COPY[outcome][0], OUTCOME_COPY[outcome][1])}
                checked={trigger.outcomes.includes(outcome)}
                onChange={(on) =>
                  onChange({ ...trigger, outcomes: toggle(trigger.outcomes, outcome, on) })
                }
              />
            ))}
          </div>
          <FilterInput
            label={t('zotz.flows.trigger.project', 'Project')}
            value={trigger.projectId}
            onChange={(projectId) => onChange({ ...trigger, projectId })}
          />
          <FilterInput
            label={t('zotz.flows.trigger.workspace', 'Workspace')}
            value={trigger.workspaceId}
            onChange={(workspaceId) => onChange({ ...trigger, workspaceId })}
          />
        </>
      )
    case 'pull_request':
      return (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {t('zotz.flows.trigger.prActions', 'When the pull request is')}
            </span>
            {ZOTZ_FLOW_PR_ACTIONS.map((action) => (
              <CheckRow
                key={action}
                label={t(PR_COPY[action][0], PR_COPY[action][1])}
                checked={trigger.actions.includes(action)}
                onChange={(on) => {
                  const actions = toggle(trigger.actions, action, on)
                  if (actions.length > 0) {
                    onChange({ ...trigger, actions })
                  }
                }}
              />
            ))}
          </div>
          <FilterInput
            label={t('zotz.flows.trigger.repo', 'Repository (owner/name)')}
            value={trigger.repo}
            onChange={(repo) => onChange({ ...trigger, repo })}
          />
          <FilterInput
            label={t('zotz.flows.trigger.baseBranch', 'Base branch')}
            value={trigger.baseBranch}
            onChange={(baseBranch) => onChange({ ...trigger, baseBranch })}
          />
          <FilterInput
            label={t('zotz.flows.trigger.label', 'Label')}
            value={trigger.label}
            onChange={(label) => onChange({ ...trigger, label })}
          />
          <FilterInput
            label={t('zotz.flows.trigger.author', 'Author')}
            value={trigger.author}
            onChange={(author) => onChange({ ...trigger, author })}
          />
        </>
      )
    case 'task_moved':
      return (
        <>
          <FilterInput
            label={t('zotz.flows.trigger.source', 'Board source')}
            value={trigger.source}
            onChange={(source) => onChange({ ...trigger, source })}
          />
          <FilterInput
            label={t('zotz.flows.trigger.project', 'Project')}
            value={trigger.project}
            onChange={(project) => onChange({ ...trigger, project })}
          />
          <FilterInput
            label={t('zotz.flows.trigger.fromColumn', 'From column')}
            value={trigger.fromColumn}
            onChange={(fromColumn) => onChange({ ...trigger, fromColumn })}
          />
          <FilterInput
            label={t('zotz.flows.trigger.toColumn', 'To column')}
            value={trigger.toColumn}
            onChange={(toColumn) => onChange({ ...trigger, toColumn })}
          />
        </>
      )
    case 'webhook': {
      const route = `/zotz/flows/hooks/${trigger.id}`
      return (
        <>
          <ZotzFlowField label={t('zotz.flows.trigger.route', 'Route (POST)')}>
            {(id) => <Input variant="code" id={id} readOnly value={route} />}
          </ZotzFlowField>
          <ZotzFlowField label={t('zotz.flows.trigger.token', 'Token (send it in a header)')}>
            {(id) => (
              <div className="flex items-center gap-1">
                <Input variant="code" id={id} readOnly value={trigger.token} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t('zotz.flows.trigger.copyToken', 'Copy token')}
                  onClick={() => void navigator.clipboard.writeText(trigger.token)}
                >
                  <Copy />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t('zotz.flows.trigger.newToken', 'New token')}
                  onClick={() => onChange({ ...createZotzFlowTrigger('webhook', trigger.id) })}
                >
                  <RefreshCw />
                </Button>
              </div>
            )}
          </ZotzFlowField>
        </>
      )
    }
  }
}
