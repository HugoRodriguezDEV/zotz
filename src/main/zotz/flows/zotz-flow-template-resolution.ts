import type {
  ZotzFlowChatContext,
  ZotzFlowNodeOutput,
  ZotzFlowNodeRunStatus,
  ZotzFlowRunTrigger
} from '../../../shared/zotz/flows/zotz-flow-run-contract'
import {
  parseZotzFlowTemplate,
  type ZotzFlowTemplateRef
} from '../../../shared/zotz/flows/zotz-flow-template-refs'

export type ZotzFlowLoopItem = { value: unknown; index: number; total: number }

export type ZotzFlowTemplateNodeView = {
  status: ZotzFlowNodeRunStatus
  output: ZotzFlowNodeOutput | null
  exitCode: number | null
}

/** What `{{ ... }}` can read while one node resolves its fields (spec §4.5). */
export type ZotzFlowTemplateScope = {
  trigger: ZotzFlowRunTrigger
  chat: ZotzFlowChatContext | null
  item: ZotzFlowLoopItem | null
  node: (name: string) => ZotzFlowTemplateNodeView | null
}

function readPath(value: unknown, path: readonly string[]): unknown {
  let current = value
  for (const segment of path) {
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      current = current[Number(segment)]
    } else if (current !== null && typeof current === 'object') {
      // Own keys only, so `{{x.json.__proto__}}` never reaches the prototype chain.
      current = Object.getOwnPropertyDescriptor(current, segment)?.value
    } else {
      return undefined
    }
  }
  return current
}

function readRef(ref: ZotzFlowTemplateRef, scope: ZotzFlowTemplateScope): unknown {
  switch (ref.root) {
    case 'trigger':
      return readPath(scope.trigger, ref.path)
    case 'chat':
      return scope.chat ? readPath(scope.chat, ref.path) : undefined
    case 'item': {
      const item = scope.item
      if (!item) {
        return undefined
      }
      if (ref.path.length === 1 && ref.path[0] === 'index') {
        return item.index
      }
      if (ref.path.length === 1 && ref.path[0] === 'total') {
        return item.total
      }
      return readPath(item.value, ref.path)
    }
    case 'node': {
      const view = scope.node(ref.nodeName)
      if (!view) {
        return undefined
      }
      switch (ref.property) {
        case 'output':
          return view.output?.markdown ?? undefined
        case 'json':
          return readPath(view.output?.json, ref.path)
        case 'status':
          return view.status
        case 'exitCode':
          return view.exitCode ?? undefined
      }
    }
  }
}

export function stringifyZotzFlowValue(value: unknown): string {
  if (value === undefined || value === null) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value, null, 2)
}

/** Text with every reference replaced; references to nothing become empty text. */
export function resolveZotzFlowTemplate(text: string, scope: ZotzFlowTemplateScope): string {
  const { refs } = parseZotzFlowTemplate(text)
  if (refs.length === 0) {
    return text
  }
  let result = ''
  let cursor = 0
  for (const ref of refs) {
    result += text.slice(cursor, ref.start) + stringifyZotzFlowValue(readRef(ref, scope))
    cursor = ref.end
  }
  return result + text.slice(cursor)
}

/** A field that is exactly one reference keeps its raw value (an array stays an array). */
export function resolveZotzFlowTemplateValue(text: string, scope: ZotzFlowTemplateScope): unknown {
  const trimmed = text.trim()
  const { refs, issues } = parseZotzFlowTemplate(trimmed)
  const only = refs[0]
  if (refs.length === 1 && issues.length === 0 && only.start === 0 && only.end === trimmed.length) {
    return readRef(only, scope)
  }
  return resolveZotzFlowTemplate(text, scope)
}
