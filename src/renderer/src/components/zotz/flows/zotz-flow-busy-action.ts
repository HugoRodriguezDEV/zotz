export type ZotzFlowActionOutcome<T> = { ok: true; value: T } | { ok: false; error: string }

/**
 * Runs `action` behind a busy flag and turns a throw into its message. Lives outside the
 * components because React Compiler cannot compile try/finally inside them.
 */
export async function runZotzFlowBusyAction<T>(
  setBusy: (busy: boolean) => void,
  action: () => Promise<T>
): Promise<ZotzFlowActionOutcome<T>> {
  setBusy(true)
  try {
    return { ok: true, value: await action() }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  } finally {
    setBusy(false)
  }
}
