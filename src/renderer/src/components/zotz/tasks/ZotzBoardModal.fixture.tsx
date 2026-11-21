import { defineFixture } from '../../../component-fixtures/component-fixture'
import { ZotzBoardModal } from './ZotzBoardModal'
import { openZotzBoard } from './zotz-board-modal-store'

export const empty = defineFixture({
  width: 1100,
  setup: () => openZotzBoard(),
  render: () => <ZotzBoardModal />
})
