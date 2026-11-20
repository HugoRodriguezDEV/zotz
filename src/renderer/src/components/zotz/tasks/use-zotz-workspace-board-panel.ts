import { useEffect } from 'react'
import {
  TOGGLE_WORKSPACE_BOARD_EVENT,
  type WorkspaceBoardPanelState
} from '../../sidebar/workspace-board/surface/useWorkspaceBoardPanel'
import { toggleZotzBoard } from './zotz-board-modal-store'

function ignore(): void {}

const HIDDEN_WORKSPACE_BOARD: WorkspaceBoardPanelState = {
  workspaceBoardOpen: false,
  workspaceBoardRenderedOpen: false,
  workspaceBoardDragPreviewOpen: false,
  workspaceBoardMenuOpen: false,
  openWorkspaceBoard: () => toggleZotzBoard('tasks'),
  closeWorkspaceBoard: ignore,
  toggleWorkspaceBoard: () => toggleZotzBoard('tasks'),
  handleWorkspaceBoardOpenChange: ignore,
  setWorkspaceBoardMenuOpen: ignore,
  previewWorkspaceBoardFromDrag: ignore,
  solidifyWorkspaceBoardFromDrag: ignore,
  cancelWorkspaceBoardDragPreview: ignore
}

/** Zotz hides Orca's workspace board: its shortcut and command open the task board instead. */
export function useZotzWorkspaceBoardPanel(): WorkspaceBoardPanelState {
  useEffect(() => {
    const toggle = (): void => toggleZotzBoard('tasks')
    window.addEventListener(TOGGLE_WORKSPACE_BOARD_EVENT, toggle)
    return () => window.removeEventListener(TOGGLE_WORKSPACE_BOARD_EVENT, toggle)
  }, [])
  return HIDDEN_WORKSPACE_BOARD
}
