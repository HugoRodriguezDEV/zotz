import { LOCAL_EXECUTION_HOST_ID } from '../../../../../shared/execution-host'
import {
  ZOTZ_FLOW_DEFAULT_CONCURRENCY,
  ZOTZ_FLOW_DEFAULT_MAX_RUNS_PER_HOUR,
  type ZotzFlowDraft
} from '../../../../../shared/zotz/flows/zotz-flow-contract'
import { createZotzFlowTrigger } from './zotz-flow-trigger-catalog'
import { newZotzFlowId } from './zotz-flow-graph-edits'
import { zotzFlowSlugFromName } from './zotz-flow-slug'

/** A fresh flow on this machine with a manual trigger; slug kept unique among `taken`. */
export function createZotzFlowDraft(name: string, taken: readonly string[]): ZotzFlowDraft {
  const base = zotzFlowSlugFromName(name)
  let slug = base
  for (let index = 2; taken.includes(slug); index += 1) {
    slug = `${base}-${index}`
  }
  return {
    id: newZotzFlowId(),
    name,
    slug,
    description: '',
    hostId: LOCAL_EXECUTION_HOST_ID,
    enabled: true,
    triggers: [createZotzFlowTrigger('manual', newZotzFlowId())],
    nodes: [],
    edges: [],
    concurrency: { ...ZOTZ_FLOW_DEFAULT_CONCURRENCY },
    maxRunsPerHour: ZOTZ_FLOW_DEFAULT_MAX_RUNS_PER_HOUR
  }
}
