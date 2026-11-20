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
  openWorkspaceBoard: toggleZotzBoard,
  closeWorkspaceBoard: ignore,
  toggleWorkspaceBoard: toggleZotzBoard,
  handleWorkspaceBoardOpenChange: ignore,
  setWorkspaceBoardMenuOpen: ignore,
  previewWorkspaceBoardFromDrag: ignore,
  solidifyWorkspaceBoardFromDrag: ignore,
  cancelWorkspaceBoardDragPreview: ignore
}

/** Zotz hides Orca's workspace board: its shortcut and command toggle the task board instead. */
export function useZotzWorkspaceBoardPanel(): WorkspaceBoardPanelState {
  useEffect(() => {
    window.addEventListener(TOGGLE_WORKSPACE_BOARD_EVENT, toggleZotzBoard)
    return () => window.removeEventListener(TOGGLE_WORKSPACE_BOARD_EVENT, toggleZotzBoard)
  }, [])
  return HIDDEN_WORKSPACE_BOARD
}
