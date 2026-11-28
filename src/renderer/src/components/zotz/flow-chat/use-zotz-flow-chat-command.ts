import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react'
import { translate } from '@/i18n/i18n'
import type { NativeChatPickerItem } from '../../../../../shared/native-chat/input/composer/native-chat-picker-items'
import type {
  NativeChatSessionSkill,
  SlashCommandSuggestion
} from '../../../../../shared/native-chat/input/commands/native-chat-slash-commands'
import {
  parseZotzFlowChatDraft,
  ZOTZ_FLOW_CHAT_COMMAND,
  zotzFlowChatShortcuts,
  type ZotzFlowChatDraft
} from '../../../../../shared/zotz/flows/zotz-flow-chat-command'
import type { NativeChatStructuredComposerTransport } from '@/components/native-chat/composer/submit/native-chat-structured-composer-transport'
import type { NativeChatPickerState } from '@/components/native-chat/composer/pickers/use-native-chat-picker-state'
import { nativeChatPendingAttachmentSnapshot } from '@/components/native-chat/attachments/chips/native-chat-pending-attachment-cache'
import {
  clearNativeChatComposerDraftIfUnchanged,
  readNativeChatComposerDraft
} from '@/components/native-chat/drafts/native-chat-composer-draft-store'
import { structuredAgentSessionDraftScopeKey } from '@/components/native-chat/drafts/native-chat-draft-scope'
import { zotzFlowChatMachines, type ZotzFlowChatMachine } from './zotz-flow-chat-rpc'
import {
  loadZotzFlowChatCatalog,
  openZotzFlowChatDialog,
  readZotzFlowChatEntries,
  useZotzFlowChatCatalogs,
  type ZotzFlowChatMachineEntry
} from './zotz-flow-chat-store'
import { runZotzFlowFromChat } from './zotz-flow-chat-launch'

type Transport = Pick<
  NativeChatStructuredComposerTransport,
  'sessionId' | 'runtimeEnvironmentId' | 'worktreeId' | 'onError' | 'capturePresentation'
>

export type ZotzFlowChatShortcutMap = ReadonlyMap<string, ZotzFlowChatMachineEntry>

const NO_SHORTCUTS: ZotzFlowChatShortcutMap = new Map()

/**
 * `/flow` and each visible flow shortcut as rows of the `/` menu, after the agent's own commands
 * so a same-named agent command or skill keeps its name (spec §6.1).
 */
export function useZotzFlowChatRows(
  transport: Transport | undefined,
  commands: readonly SlashCommandSuggestion[],
  skills: readonly NativeChatSessionSkill[] | undefined
): { commands: readonly SlashCommandSuggestion[]; shortcuts: ZotzFlowChatShortcutMap } {
  const environmentId = transport ? transport.runtimeEnvironmentId : undefined
  const machines = useMemo(
    () => (environmentId === undefined ? [] : zotzFlowChatMachines(environmentId)),
    [environmentId]
  )
  const catalog = useZotzFlowChatCatalogs()
  useEffect(() => {
    void loadZotzFlowChatCatalog(machines)
  }, [machines])
  return useMemo(() => {
    if (machines.length === 0) {
      return { commands, shortcuts: NO_SHORTCUTS }
    }
    const shortcuts = zotzFlowChatShortcuts(readZotzFlowChatEntries(machines, catalog), [
      ...commands.filter((command) => !command.orcaOwned).map((command) => command.name),
      ...(skills ?? []).map((skill) => skill.name)
    ])
    const text = translate('zotz.flowChat.argumentHint', '[text]')
    const rows: SlashCommandSuggestion[] = [
      {
        name: ZOTZ_FLOW_CHAT_COMMAND,
        description: translate('zotz.flowChat.commandDescription', 'Run a Zotz flow'),
        argumentHint: translate('zotz.flowChat.flowArgumentHint', '[flow] [text]'),
        orcaOwned: true
      },
      ...[...shortcuts].map(([name, entry]): SlashCommandSuggestion => ({
        name,
        description: translate('zotz.flowChat.shortcutDescription', 'Flow: {{flow}}', {
          flow: entry.flow.name
        }),
        argumentHint: text,
        orcaOwned: true
      }))
    ]
    return {
      // Zotz's `/flow` replaces an agent `flow` command, as `/btw` does.
      commands: [...commands.filter((command) => command.name !== ZOTZ_FLOW_CHAT_COMMAND), ...rows],
      shortcuts
    }
  }, [catalog, commands, machines, skills])
}

function resolveEntry(
  parsed: ZotzFlowChatDraft,
  machines: readonly ZotzFlowChatMachine[],
  shortcuts: ZotzFlowChatShortcutMap
): ZotzFlowChatMachineEntry | null {
  switch (parsed.kind) {
    case 'menu':
      return null
    case 'shortcut':
      return shortcuts.get(parsed.name) ?? null
    case 'slug':
      return readZotzFlowChatEntries(machines).find((e) => e.flow.slug === parsed.slug) ?? null
  }
}

export type ZotzFlowChatCommand = {
  matchesDraft: (draft: string) => boolean
  /** Runs `/flow` or a flow shortcut; false means the draft is not Zotz's. */
  consume: (draft: string) => boolean
  /** Choosing the row completes `/flow ` or the shortcut; only Send runs it. */
  interceptPick: <TItem extends NativeChatPickerItem>(
    pick: (item: TItem) => void
  ) => (item: TItem) => void
}

/** `/flow [slug] [text]` and `/<shortcut> [text]` run a flow with this chat's context; the
 *  agent never receives the command (spec §6.1). Returns `upstream` with Zotz's commands added. */
export function useZotzFlowChatCommand(args: {
  structuredTransport: Transport | undefined
  agent: string
  shortcuts: ZotzFlowChatShortcutMap
  picker: Pick<NativeChatPickerState, 'isPickedSkill' | 'completeItem'> & {
    autocomplete: { mode: string; dispatchable?: boolean }
  }
  editor: { setCaret: Dispatch<SetStateAction<number>> }
  /** Orca's own chat commands; a draft or pick they own never reaches Zotz's. */
  upstream: ZotzFlowChatCommand
}): ZotzFlowChatCommand {
  const { structuredTransport: transport, agent, shortcuts } = args
  const { autocomplete, isPickedSkill, completeItem } = args.picker
  const { setCaret } = args.editor
  const matchesDraft = useCallback(
    (draft: string) =>
      transport !== undefined &&
      !isPickedSkill(draft) &&
      parseZotzFlowChatDraft(draft, shortcuts) !== null,
    [isPickedSkill, shortcuts, transport]
  )
  const consume = useCallback(
    (draft: string): boolean => {
      const parsed = parseZotzFlowChatDraft(draft, shortcuts)
      if (!transport || !parsed || isPickedSkill(draft)) {
        return false
      }
      const { onError, sessionId } = transport
      const draftScopeKey = structuredAgentSessionDraftScopeKey(sessionId)
      if (nativeChatPendingAttachmentSnapshot(draftScopeKey).length > 0) {
        onError(
          translate(
            'zotz.flowChat.attachmentsPending',
            'Attachments are still uploading. Send the command again once they finish.'
          )
        )
        return true
      }
      const submitted = readNativeChatComposerDraft(draftScopeKey)
      const isCurrent = transport.capturePresentation()
      const machines = zotzFlowChatMachines(transport.runtimeEnvironmentId)
      const origin = {
        sessionId,
        agent,
        worktreeId: transport.worktreeId,
        draftScopeKey
      }
      const onStarted = (): void => {
        if (clearNativeChatComposerDraftIfUnchanged(draftScopeKey, submitted) && isCurrent()) {
          onError(null)
          setCaret(0)
        }
      }
      if (parsed.kind === 'menu') {
        void loadZotzFlowChatCatalog(machines, true)
        openZotzFlowChatDialog({ kind: 'menu', sessionId, onStarted })
        return true
      }
      void (async () => {
        let entry = resolveEntry(parsed, machines, shortcuts)
        if (!entry) {
          // A flow saved a moment ago may not be in the catalog yet.
          await loadZotzFlowChatCatalog(machines, true)
          entry = resolveEntry(parsed, machines, shortcuts)
        }
        if (!entry) {
          if (isCurrent()) {
            onError(
              translate('zotz.flowChat.notFound', 'No flow "{{name}}" runs from this chat.', {
                name: parsed.kind === 'slug' ? parsed.slug : parsed.name
              })
            )
          }
          return
        }
        if (entry.trigger.inputs.length > 0) {
          openZotzFlowChatDialog({ kind: 'form', sessionId, entry, text: parsed.text, onStarted })
          return
        }
        const result = await runZotzFlowFromChat(entry, origin, parsed.text, {})
        if (result.ok) {
          onStarted()
        } else if (isCurrent()) {
          onError(result.error)
        }
      })()
      return true
    },
    [agent, isPickedSkill, setCaret, shortcuts, transport]
  )
  const interceptPick = useCallback(
    <TItem extends NativeChatPickerItem>(pick: (item: TItem) => void) =>
      (item: TItem) => {
        const leading = autocomplete.mode === 'slash' && autocomplete.dispatchable === true
        const name = item.kind === 'command' && item.orcaOwned ? item.name : null
        if (
          leading &&
          transport &&
          name !== null &&
          (name === ZOTZ_FLOW_CHAT_COMMAND || shortcuts.has(name))
        ) {
          completeItem(item)
        } else {
          pick(item)
        }
      },
    [autocomplete, completeItem, shortcuts, transport]
  )
  const { upstream } = args
  return useMemo(
    () => ({
      matchesDraft: (draft) => upstream.matchesDraft(draft) || matchesDraft(draft),
      consume: (draft) => upstream.consume(draft) || consume(draft),
      interceptPick: (pick) => interceptPick(upstream.interceptPick(pick))
    }),
    [consume, interceptPick, matchesDraft, upstream]
  )
}
