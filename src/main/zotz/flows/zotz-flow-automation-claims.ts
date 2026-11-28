/**
 * Automations a flow took over (spec §8). Their runs are cancelled before dispatch so a migrated
 * automation never runs on both sides, even if someone turns it back on while its flow is on.
 */
type Claims = (automationId: string) => boolean

export const ZOTZ_FLOW_CLAIMED_AUTOMATION =
  'This automation runs as a flow now. Turn its flow off in Flows to run it here again.'

let claims: Claims | null = null
// Between Zotz starting flows and the flow store loading, nobody can tell yet: due automations wait.
let holding = false

export function holdZotzFlowAutomationClaims(): void {
  holding = true
}

export function setZotzFlowAutomationClaims(next: Claims | null): void {
  claims = next
  holding = false
}

export function isZotzFlowClaimedAutomation(automationId: string): boolean {
  return holding || (claims?.(automationId) ?? false)
}
