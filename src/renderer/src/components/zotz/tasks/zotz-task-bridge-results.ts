/**
 * The paired web client stubs bridges it lacks with empty answers, so every result from
 * `window.api.zotzTaskConnectors` is checked before it reaches state.
 */
export function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

export function asRecord<T>(value: Record<string, T> | null | undefined): Record<string, T> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {}
}
