import {
  Bell,
  Bot,
  FileText,
  Globe,
  Hourglass,
  Merge,
  MessageSquareReply,
  Repeat,
  Route,
  ShieldCheck,
  Split,
  SquareTerminal,
  Workflow,
  GitFork,
  type LucideIcon
} from 'lucide-react'
import type {
  ZotzFlowNode,
  ZotzFlowNodeKind,
  ZotzFlowNodeOf
} from '../../../../../shared/zotz/flows/zotz-flow-node-contract'
import { isZotzFlowNodeOfKind } from './zotz-flow-form-values'

type NodeKindInfo = {
  icon: LucideIcon
  /** Translation key and English fallback. */
  copy: readonly [string, string]
  /** Default name base; names are template identifiers, so ASCII without dots or dashes. */
  baseName: string
}

export const ZOTZ_FLOW_NODE_KINDS: Record<ZotzFlowNodeKind, NodeKindInfo> = {
  agent: { icon: Bot, copy: ['zotz.flows.kind.agent', 'Agent'], baseName: 'agent' },
  command: {
    icon: SquareTerminal,
    copy: ['zotz.flows.kind.command', 'Command'],
    baseName: 'command'
  },
  condition: {
    icon: Split,
    copy: ['zotz.flows.kind.condition', 'Condition'],
    baseName: 'condition'
  },
  switch: { icon: Route, copy: ['zotz.flows.kind.switch', 'Switch'], baseName: 'switch' },
  parallel: {
    icon: GitFork,
    copy: ['zotz.flows.kind.parallel', 'Parallel'],
    baseName: 'parallel'
  },
  join: { icon: Merge, copy: ['zotz.flows.kind.join', 'Join'], baseName: 'join' },
  approval: {
    icon: ShieldCheck,
    copy: ['zotz.flows.kind.approval', 'Approval'],
    baseName: 'approval'
  },
  wait: { icon: Hourglass, copy: ['zotz.flows.kind.wait', 'Wait'], baseName: 'wait' },
  http: { icon: Globe, copy: ['zotz.flows.kind.http', 'HTTP request'], baseName: 'http' },
  notify: { icon: Bell, copy: ['zotz.flows.kind.notify', 'Notify'], baseName: 'notify' },
  chat_reply: {
    icon: MessageSquareReply,
    copy: ['zotz.flows.kind.chatReply', 'Reply in chat'],
    baseName: 'reply'
  },
  template: {
    icon: FileText,
    copy: ['zotz.flows.kind.template', 'Template'],
    baseName: 'template'
  },
  subflow: {
    icon: Workflow,
    copy: ['zotz.flows.kind.subflow', 'Subflow'],
    baseName: 'subflow'
  },
  for_each: {
    icon: Repeat,
    copy: ['zotz.flows.kind.forEach', 'For each'],
    baseName: 'loop'
  }
}

/** Palette order: the common steps first. */
export const ZOTZ_FLOW_PALETTE_KINDS: ZotzFlowNodeKind[] = [
  'agent',
  'command',
  'condition',
  'for_each',
  'approval',
  'template',
  'http',
  'notify',
  'switch',
  'parallel',
  'join',
  'wait',
  'chat_reply',
  'subflow'
]

export function uniqueZotzFlowNodeName(base: string, taken: readonly ZotzFlowNode[]): string {
  const names = new Set(taken.map((node) => node.name))
  if (!names.has(base)) {
    return base
  }
  let index = 2
  while (names.has(`${base}_${index}`)) {
    index += 1
  }
  return `${base}_${index}`
}

type NewNodeArgs = {
  id: string
  name: string
  position: { x: number; y: number }
  parentId?: string
}

export function createZotzFlowNode<K extends ZotzFlowNodeKind>(
  kind: K,
  args: NewNodeArgs
): ZotzFlowNodeOf<K> {
  const node = buildZotzFlowNode(kind, args)
  if (!isZotzFlowNodeOfKind(node, kind)) {
    throw new Error(`No default for step kind ${kind}`)
  }
  return node
}

function buildZotzFlowNode(kind: ZotzFlowNodeKind, args: NewNodeArgs): ZotzFlowNode {
  const base = {
    id: args.id,
    name: args.name,
    position: args.position,
    ...(args.parentId ? { parentId: args.parentId } : {}),
    retries: 0,
    onError: 'stop' as const
  }
  const markdown = { mode: 'markdown' as const }
  switch (kind) {
    case 'agent':
      return {
        ...base,
        kind,
        agentId: 'claude',
        prompt: '',
        surface: 'chat',
        workspaceSource: 'existing',
        runContext: null,
        workspaceId: null,
        reuseSession: false,
        runInChatSession: false,
        output: markdown
      }
    case 'command':
      return { ...base, kind, command: '', env: [], output: markdown }
    case 'condition':
      return { ...base, kind, value: '', operator: 'equals', compareTo: '' }
    case 'switch':
      return { ...base, kind, value: '', cases: [{ port: 'case_1', equals: '' }] }
    case 'parallel':
      return { ...base, kind }
    case 'join':
      return { ...base, kind, waitFor: 'all' }
    case 'approval':
      return { ...base, kind, message: '' }
    case 'wait':
      return { ...base, kind, wait: { mode: 'duration', seconds: 60 } }
    case 'http':
      return { ...base, kind, method: 'GET', url: 'https://', headers: [], output: markdown }
    case 'notify':
      return { ...base, kind, title: '', body: '' }
    case 'chat_reply':
      return { ...base, kind, mode: 'note', content: '' }
    case 'template':
      return { ...base, kind, content: '', output: markdown }
    case 'subflow':
      return { ...base, kind, flowId: '', inputs: {} }
    case 'for_each':
      return { ...base, kind, items: '', order: 'parallel', maxItems: 100 }
  }
}
