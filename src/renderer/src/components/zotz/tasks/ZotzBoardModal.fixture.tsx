import { defineFixture } from '../../../component-fixtures/component-fixture'
import { ZotzBoardModal } from './ZotzBoardModal'
import { openZotzBoard } from './zotz-board-modal-store'

export const tasks = defineFixture({
  width: 1100,
  setup: () => openZotzBoard('tasks'),
  render: () => <ZotzBoardModal />
})

export const agents = defineFixture({
  width: 1100,
  setup: () => openZotzBoard('agents'),
  render: () => <ZotzBoardModal />
})
