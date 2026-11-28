import { useState } from 'react'
import { createNonSecureContextUuid } from '../../../../../shared/identifiers/non-secure-context-uuid'
import type {
  ZotzFlowNode,
  ZotzFlowNodeKind,
  ZotzFlowNodeOf
} from '../../../../../shared/zotz/flows/zotz-flow-node-contract'

/** Narrows a Select's string back to one of its known options. */
export function pickZotzFlowOption<T extends string>(
  options: readonly T[],
  value: string
): T | undefined {
  return options.find((option) => option === value)
}

export function isPlainJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A pasted JSON object, or null while the text is not one yet. */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text)
    return isPlainJsonObject(value) ? value : null
  } catch {
    return null
  }
}

export function isZotzFlowNodeOfKind<K extends ZotzFlowNodeKind>(
  node: ZotzFlowNode,
  kind: K
): node is ZotzFlowNodeOf<K> {
  return node.kind === kind
}

/** Typed updater for one kind's fields; a node that changed kind meanwhile is left alone. */
export function zotzFlowKindUpdater<K extends ZotzFlowNodeKind>(
  kind: K,
  onChange: (update: (node: ZotzFlowNode) => ZotzFlowNode) => void
): (update: (node: ZotzFlowNodeOf<K>) => ZotzFlowNodeOf<K>) => void {
  return (update) =>
    onChange((current) => (isZotzFlowNodeOfKind(current, kind) ? update(current) : current))
}

/**
 * Stable React keys for an editable list whose rows have no id of their own, so removing a row
 * never hands its focus or text to the next one. A length change from outside (undo) resets them.
 */
export function useZotzFlowRowKeys<T>(rows: readonly T[]): {
  entries: { row: T; index: number; key: string }[]
  removeKey: (index: number) => void
} {
  const [keys, setKeys] = useState(() => rows.map(() => createNonSecureContextUuid()))
  let current = keys
  if (keys.length !== rows.length) {
    current =
      keys.length < rows.length
        ? [...keys, ...rows.slice(keys.length).map(() => createNonSecureContextUuid())]
        : keys.slice(0, rows.length)
    setKeys(current)
  }
  return {
    entries: rows.map((row, index) => ({ row, index, key: current[index] })),
    removeKey: (index) => setKeys((list) => list.filter((_, position) => position !== index))
  }
}
