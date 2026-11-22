import { defineFixture } from '../../../component-fixtures/component-fixture'
import { ZotzFeatureWallBody } from './ZotzFeatureWallBody'

// Reduced motion holds each storyboard on its last, most telling phase.
export const node = defineFixture({
  width: 880,
  render: () => <ZotzFeatureWallBody id="zotz-node" reducedMotion />
})

export const queue = defineFixture({
  width: 880,
  render: () => <ZotzFeatureWallBody id="zotz-queue" reducedMotion />
})

export const tasks = defineFixture({
  width: 880,
  render: () => <ZotzFeatureWallBody id="tasks" reducedMotion />
})
