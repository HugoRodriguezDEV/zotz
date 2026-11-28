import React, { useMemo } from 'react'
import { useAppStore } from '@/store/index'
import { useTranslate } from '@/i18n/use-translate'
import { getAgentCatalog } from '@/lib/agent-catalog/agent-catalog'
import { useRepoMap } from '@/store/repos/use-repository-catalog'
import { selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'
import { Switch } from '@/components/ui/switch'
import { filterEnabledTuiAgents } from '../../../../../shared/agent-launch/catalog/tui-agent-selection'
import { getRepoExecutionHostId } from '../../../../../shared/execution-host'
import type { ZotzFlowNodeOf } from '../../../../../shared/zotz/flows/zotz-flow-node-contract'
import { AutomationAgentLaunchPicker } from '../../automations/authoring/AutomationAgentLaunchPicker'
import { AutomationEditorPromptEditor } from '../../automations/authoring/AutomationEditorPromptEditor'
import AutomationProjectCombobox from '../../automations/authoring/AutomationProjectCombobox'
import { AutomationWorkspaceField } from '../../automations/authoring/AutomationWorkspaceField'
import { AutomationSessionField } from '../../automations/authoring/AutomationSessionField'
import { buildAutomationRunContextForRepo } from '../../automations/authoring/automation-run-context'
import type { AutomationDraft } from '../../automations/authoring/AutomationEditorDialog'
import { zotzFlowAgentFromDraft, zotzFlowAgentToDraft } from './zotz-flow-agent-draft'
import { ZotzFlowField, ZotzFlowSection } from './ZotzFlowFormParts'
import { ZotzFlowTemplatePicker } from './ZotzFlowTemplateInput'
import type { ZotzFlowTemplateOption } from './zotz-flow-template-options'

type AgentNode = ZotzFlowNodeOf<'agent'>
const PICKER_CLASS = 'border-input bg-input/30 shadow-xs dark:bg-input/30'

export function ZotzFlowAgentFields({
  node,
  hostId,
  hasChatTrigger,
  options,
  onChange
}: {
  node: AgentNode
  hostId: string
  hasChatTrigger: boolean
  options: readonly ZotzFlowTemplateOption[]
  onChange: (update: (node: AgentNode) => AgentNode) => void
}): React.JSX.Element {
  const t = useTranslate()
  const settings = useAppStore((s) => s.settings)
  const allRepos = useAppStore((s) => s.repos)
  const projectHostSetups = useAppStore((s) => s.projectHostSetups)
  const worktreesByRepo = useAppStore(selectWorktreesByRepo)
  const repoMap = useRepoMap()
  // The step runs on the flow's machine, so only that machine's projects apply.
  const repos = useMemo(
    () => allRepos.filter((repo) => getRepoExecutionHostId(repo) === hostId),
    [allRepos, hostId]
  )
  const draft = useMemo(() => zotzFlowAgentToDraft(node), [node])
  const worktrees = worktreesByRepo?.[draft.projectId] ?? []
  const visibleAgents = useMemo(() => {
    const enabled = new Set(
      filterEnabledTuiAgents(
        getAgentCatalog().map((agent) => agent.id),
        settings?.disabledTuiAgents
      )
    )
    return getAgentCatalog().filter((agent) => enabled.has(agent.id) || agent.id === node.agentId)
  }, [node.agentId, settings?.disabledTuiAgents])
  const onDraftChange = (updater: (current: AutomationDraft) => AutomationDraft): void =>
    onChange((current) => zotzFlowAgentFromDraft(current, updater(zotzFlowAgentToDraft(current))))
  const fromChat = node.workspaceSource === 'chat'

  return (
    <>
      <ZotzFlowSection title={t('zotz.flows.agent.title', 'Agent')}>
        <AutomationAgentLaunchPicker
          draft={draft}
          workspace={{
            kind: 'git-worktree',
            repoId: draft.projectId,
            worktreeId: draft.workspaceId || undefined
          }}
          visibleAgents={visibleAgents}
          settings={settings}
          surface={node.surface}
          chatSupported={null}
          onDraftChange={onDraftChange}
        />
      </ZotzFlowSection>
      <ZotzFlowSection
        title={t('zotz.flows.agent.prompt', 'Prompt')}
        action={
          <ZotzFlowTemplatePicker
            options={options}
            onInsert={(template) =>
              onChange((current) => ({
                ...current,
                prompt: current.prompt ? `${current.prompt} ${template}` : template
              }))
            }
          />
        }
      >
        <div className="h-48 overflow-hidden rounded-md border border-input">
          <AutomationEditorPromptEditor
            value={node.prompt}
            ariaLabel={t('zotz.flows.agent.prompt', 'Prompt')}
            placeholder={t('zotz.flows.agent.promptPlaceholder', 'What should the agent do?')}
            onChange={(prompt) => onChange((current) => ({ ...current, prompt }))}
          />
        </div>
      </ZotzFlowSection>
      <ZotzFlowSection title={t('zotz.flows.agent.where', 'Where it runs')}>
        {hasChatTrigger ? (
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={fromChat}
                onCheckedChange={(checked) =>
                  onChange((current) => ({
                    ...current,
                    workspaceSource: checked ? 'chat' : 'existing',
                    runInChatSession: checked ? current.runInChatSession : false
                  }))
                }
              />
              {t('zotz.flows.agent.chatWorkspace', "Use the chat's workspace")}
            </label>
            {fromChat ? (
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={node.runInChatSession}
                  onCheckedChange={(runInChatSession) =>
                    onChange((current) => ({ ...current, runInChatSession }))
                  }
                />
                {t('zotz.flows.agent.inChat', 'Run in this conversation')}
              </label>
            ) : null}
          </div>
        ) : null}
        {fromChat ? null : (
          <>
            <ZotzFlowField label={t('zotz.flows.agent.project', 'Project')}>
              {() => (
                <AutomationProjectCombobox
                  repos={repos}
                  value={draft.projectId}
                  placeholder={t('zotz.flows.agent.projectPlaceholder', 'Select project')}
                  triggerClassName={`h-9 w-full min-w-0 ${PICKER_CLASS}`}
                  onValueChange={(repoId) => {
                    const runContext = buildAutomationRunContextForRepo({
                      repoId,
                      repos,
                      projectHostSetups
                    })
                    onChange((current) => ({
                      ...current,
                      runContext,
                      workspaceId: null,
                      baseBranch: null
                    }))
                  }}
                />
              )}
            </ZotzFlowField>
            {draft.projectId && !node.runContext ? (
              <p className="text-xs text-destructive">
                {t(
                  'zotz.flows.agent.projectNotReady',
                  'This project is not set up on the machine yet.'
                )}
              </p>
            ) : null}
            <AutomationWorkspaceField
              draft={draft}
              worktrees={worktrees}
              repoMap={repoMap}
              pickerTriggerClassName={PICKER_CLASS}
              onDraftChange={onDraftChange}
            />
            <AutomationSessionField draft={draft} onDraftChange={onDraftChange} />
          </>
        )}
      </ZotzFlowSection>
    </>
  )
}
