import { defineFixture } from '../../../component-fixtures/component-fixture'
import ZotzBoardPage from './ZotzBoardPage'

export const empty = defineFixture({
  width: 1100,
  render: () => (
    <div className="flex h-[600px]">
      <ZotzBoardPage />
    </div>
  )
})
