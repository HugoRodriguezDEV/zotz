import { useCallback, useMemo, useReducer } from 'react'
import type { ZotzFlowDraft } from '../../../../../shared/zotz/flows/zotz-flow-contract'

export type ZotzFlowSelection =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'triggers'; triggerId: string | null }
  | null

type State = {
  draft: ZotzFlowDraft
  past: ZotzFlowDraft[]
  future: ZotzFlowDraft[]
  selection: ZotzFlowSelection
}

type Update = (draft: ZotzFlowDraft) => ZotzFlowDraft

type Action =
  | { type: 'edit'; update: Update; select?: ZotzFlowSelection }
  | { type: 'transient'; update: Update }
  | { type: 'checkpoint' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'select'; selection: ZotzFlowSelection }
  | { type: 'reset'; draft: ZotzFlowDraft }

const HISTORY_LIMIT = 100

function push(past: ZotzFlowDraft[], draft: ZotzFlowDraft): ZotzFlowDraft[] {
  return [...past.slice(-(HISTORY_LIMIT - 1)), draft]
}

function selectionExists(draft: ZotzFlowDraft, selection: ZotzFlowSelection): boolean {
  if (selection?.kind === 'node') {
    return draft.nodes.some((node) => node.id === selection.id)
  }
  if (selection?.kind === 'edge') {
    return draft.edges.some((edge) => edge.id === selection.id)
  }
  return true
}

function keepSelection(draft: ZotzFlowDraft, selection: ZotzFlowSelection): ZotzFlowSelection {
  return selectionExists(draft, selection) ? selection : null
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'edit': {
      const draft = action.update(state.draft)
      if (draft === state.draft) {
        return action.select === undefined ? state : { ...state, selection: action.select }
      }
      return {
        draft,
        past: push(state.past, state.draft),
        future: [],
        selection: keepSelection(
          draft,
          action.select === undefined ? state.selection : action.select
        )
      }
    }
    case 'transient':
      return { ...state, draft: action.update(state.draft) }
    case 'checkpoint':
      return { ...state, past: push(state.past, state.draft), future: [] }
    case 'undo': {
      const previous = state.past.at(-1)
      if (!previous) {
        return state
      }
      return {
        draft: previous,
        past: state.past.slice(0, -1),
        future: [state.draft, ...state.future],
        selection: keepSelection(previous, state.selection)
      }
    }
    case 'redo': {
      const [next, ...rest] = state.future
      if (!next) {
        return state
      }
      return {
        draft: next,
        past: push(state.past, state.draft),
        future: rest,
        selection: keepSelection(next, state.selection)
      }
    }
    case 'select':
      return { ...state, selection: action.selection }
    case 'reset':
      return { draft: action.draft, past: [], future: [], selection: null }
  }
}

export type ZotzFlowEditorState = ReturnType<typeof useZotzFlowEditorState>

export function useZotzFlowEditorState(initial: ZotzFlowDraft) {
  const [state, dispatch] = useReducer(reducer, {
    draft: initial,
    past: [],
    future: [],
    selection: null
  })
  const edit = useCallback(
    (update: Update, select?: ZotzFlowSelection) => dispatch({ type: 'edit', update, select }),
    []
  )
  const transient = useCallback((update: Update) => dispatch({ type: 'transient', update }), [])
  const checkpoint = useCallback(() => dispatch({ type: 'checkpoint' }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])
  const select = useCallback(
    (selection: ZotzFlowSelection) => dispatch({ type: 'select', selection }),
    []
  )
  const reset = useCallback((draft: ZotzFlowDraft) => dispatch({ type: 'reset', draft }), [])
  return useMemo(
    () => ({
      draft: state.draft,
      selection: state.selection,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      edit,
      transient,
      checkpoint,
      undo,
      redo,
      select,
      reset
    }),
    [state, edit, transient, checkpoint, undo, redo, select, reset]
  )
}
