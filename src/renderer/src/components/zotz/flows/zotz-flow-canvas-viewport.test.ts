import { describe, expect, it } from 'vitest'
import { zotzFlowOpeningViewport } from './zotz-flow-canvas-viewport'

describe('zotzFlowOpeningViewport', () => {
  it('centers a small flow at 100%', () => {
    expect(
      zotzFlowOpeningViewport({ x: 0, y: 0, width: 200, height: 100 }, { width: 800, height: 600 })
    ).toEqual({
      zoom: 1,
      x: 300,
      y: 250
    })
  })

  it('starts a wide flow at its top-left corner instead of shrinking it below 0.8', () => {
    expect(
      zotzFlowOpeningViewport(
        { x: -300, y: 50, width: 2000, height: 200 },
        { width: 800, height: 600 }
      )
    ).toEqual({ zoom: 0.8, x: 272, y: -8 })
  })
})
