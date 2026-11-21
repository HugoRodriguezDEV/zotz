import type { TuiAgent } from '../agent-launch/catalog/tui-agent'
import type { ZotzTaskBoardArchivedTask, ZotzTaskBoardSource } from './tasks/zotz-task-board-types'
import type { ZotzTaskConnectorConfig } from './tasks/zotz-task-connector-types'
import type { ZotzTaskBoardView } from './tasks/zotz-task-board-views'
import type { ZotzTaskRelayConfig } from './tasks/zotz-task-relay-types'

/** Settings only Zotz reads; kept out of GlobalSettings' body so upstream syncs merge cleanly. */
export type ZotzGlobalSettings = {
  /** 'unset' shows the first-run wizard; 'server' keeps the node awake and network-exposed. */
  zotzMachineMode?: 'unset' | 'personal' | 'server'
  /** Catalog agents already offered once, so only ones added later start hidden. */
  zotzSeenTuiAgents?: TuiAgent[]
  /** Check, download and offer releases of the fork; off only when set to false. */
  zotzUpdatesEnabled?: boolean
  /** Hold agent launches until they fit in memory; off only when set to false. */
  zotzAgentQueueEnabled?: boolean
  /** Download Orca's plugin catalogs and safety list; off unless set to true, since Zotz is a fork. */
  zotzOrcaPluginCatalogEnabled?: boolean
  /** App version whose startup already checked (and if needed registered) the `zotz` command. */
  zotzCliRegisteredVersion?: string
  /** 'orca' brings back upstream's workspace cards; anything else is the simple project list. */
  zotzSidebarLayout?: 'conductor' | 'orca'
  /** GitHub Projects shown on the task board, in the order they were picked. */
  zotzTaskBoardSources?: ZotzTaskBoardSource[]
  /** Finished tasks hidden from the task board's Done column. */
  zotzTaskBoardArchived?: ZotzTaskBoardArchivedTask[]
  /** External task services (zotz-tasks/v1 feeds or imported files) shown on the task board. */
  zotzTaskConnectors?: ZotzTaskConnectorConfig[]
  /** Saved task board views (filter, layout, grouping, sorting). */
  zotzTaskBoardViews?: ZotzTaskBoardView[]
  /** Optional own webhook relay for instant board updates; absent or disabled means none. */
  zotzTaskRelay?: ZotzTaskRelayConfig
}
