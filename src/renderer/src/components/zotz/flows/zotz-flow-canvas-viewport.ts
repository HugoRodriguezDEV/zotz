type Rect = { x: number; y: number; width: number; height: number }
type Viewport = { x: number; y: number; zoom: number }

/** Below this the step names get too small to read (Hugo's eyesight rule). */
export const ZOTZ_FLOW_MIN_READABLE_ZOOM = 0.8
const PADDING = 32

/**
 * Where a flow opens: centered and whole when it fits between the readable zoom and 100%;
 * otherwise at the readable zoom from its top-left corner (the triggers), panning for the rest.
 */
export function zotzFlowOpeningViewport(
  bounds: Rect,
  view: { width: number; height: number }
): Viewport {
  const fit = Math.min(
    1,
    (view.width - PADDING * 2) / Math.max(bounds.width, 1),
    (view.height - PADDING * 2) / Math.max(bounds.height, 1)
  )
  if (fit >= ZOTZ_FLOW_MIN_READABLE_ZOOM) {
    return {
      zoom: fit,
      x: view.width / 2 - (bounds.x + bounds.width / 2) * fit,
      y: view.height / 2 - (bounds.y + bounds.height / 2) * fit
    }
  }
  const zoom = ZOTZ_FLOW_MIN_READABLE_ZOOM
  return { zoom, x: PADDING - bounds.x * zoom, y: PADDING - bounds.y * zoom }
}
