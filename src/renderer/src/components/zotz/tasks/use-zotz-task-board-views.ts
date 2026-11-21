import { useMemo, useState } from 'react'
import { useAppStore } from '@/store/index'
import { createNonSecureContextUuid } from '../../../../../shared/identifiers/non-secure-context-uuid'
import {
  DEFAULT_ZOTZ_TASK_BOARD_VIEW,
  readZotzTaskBoardViews,
  type ZotzTaskBoardView
} from '../../../../../shared/zotz/tasks/zotz-task-board-views'

export type ZotzTaskBoardViewsState = {
  views: ZotzTaskBoardView[]
  view: ZotzTaskBoardView
  /** The active view has edits that are not saved yet, like GitHub's dot on a view tab. */
  dirty: boolean
  select: (id: string) => void
  update: (patch: Partial<Omit<ZotzTaskBoardView, 'id'>>) => void
  save: () => void
  discard: () => void
  create: (name: string) => void
  rename: (id: string, name: string) => void
  remove: (id: string) => void
}

const VIEW_SETTINGS: readonly Exclude<keyof ZotzTaskBoardView, 'id'>[] = [
  'name',
  'scope',
  'layout',
  'filter',
  'groupBy',
  'sortBy',
  'sumField',
  'sliceBy',
  'roadmapStart',
  'roadmapEnd',
  'roadmapZoom'
]

function sameView(a: ZotzTaskBoardView, b: ZotzTaskBoardView): boolean {
  return VIEW_SETTINGS.every((key) => a[key] === b[key])
}

/** Saved board views plus unsaved edits to the active one. */
export function useZotzTaskBoardViews(): ZotzTaskBoardViewsState {
  const raw = useAppStore((s) => s.settings?.zotzTaskBoardViews)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const views = useMemo(() => readZotzTaskBoardViews(raw), [raw])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ZotzTaskBoardView | null>(null)

  const saved =
    views.find((item) => item.id === activeId) ?? views[0] ?? DEFAULT_ZOTZ_TASK_BOARD_VIEW
  const view = draft && draft.id === saved.id ? draft : saved
  const store = (next: ZotzTaskBoardView[]): void => {
    void updateSettings({ zotzTaskBoardViews: next })
  }

  return {
    views,
    view,
    dirty: !sameView(view, saved),
    select: (id) => {
      setActiveId(id)
      setDraft(null)
    },
    update: (patch) => setDraft({ ...view, ...patch }),
    save: () => {
      store(views.map((item) => (item.id === view.id ? view : item)))
      setDraft(null)
    },
    discard: () => setDraft(null),
    create: (name) => {
      const next: ZotzTaskBoardView = { ...view, id: createNonSecureContextUuid(), name }
      store([...views.map((item) => (item.id === saved.id ? saved : item)), next])
      setActiveId(next.id)
      setDraft(null)
    },
    rename: (id, name) => {
      const trimmed = name.trim()
      if (trimmed) {
        store(views.map((item) => (item.id === id ? { ...item, name: trimmed } : item)))
        if (draft?.id === id) {
          setDraft({ ...draft, name: trimmed })
        }
      }
    },
    remove: (id) => {
      if (views.length > 1) {
        store(views.filter((item) => item.id !== id))
        setActiveId(null)
        setDraft(null)
      }
    }
  }
}
