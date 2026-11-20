import type {
  ZotzTaskConnectorImportResult,
  ZotzTaskConnectorSnapshot
} from '../../../shared/zotz/tasks/zotz-task-connector-types'
import type { ZotzRepoIssues } from '../../../shared/zotz/tasks/zotz-repo-issues'
import type {
  ZotzIssueRef,
  ZotzTaskDevelopment
} from '../../../shared/zotz/tasks/zotz-task-development-types'

export type ZotzTaskConnectorsApi = {
  /** Fires when a connector changed outside this window, e.g. `zotz tasks push`. */
  onChanged: (callback: () => void) => () => void
  /** Last document of every connector, read from disk; no network. */
  snapshot: () => Promise<ZotzTaskConnectorSnapshot[]>
  /** Downloads these feeds now and returns every connector's state. */
  refresh: (connectors: { id: string; url: string }[]) => Promise<ZotzTaskConnectorSnapshot[]>
  /** Encrypts and stores the feed's bearer token; null clears it. False when the OS can't encrypt. */
  setToken: (id: string, token: string | null) => Promise<boolean>
  /** Opens a file picker and imports a zotz-tasks/v1 document. */
  importFile: () => Promise<ZotzTaskConnectorImportResult>
  remove: (id: string) => Promise<void>
  /** Matches services' tasks to PRs in these repos and sends link-pr for what changed. */
  syncPullRequests: (repos: string[]) => Promise<ZotzTaskConnectorSnapshot[]>
  /** Moves a task to another Status option on a service that verified `move`. */
  move: (
    id: string,
    taskId: string,
    optionId: string
  ) => Promise<{ ok: true; snapshot: ZotzTaskConnectorSnapshot } | { ok: false; error: string }>
  /** Linked PRs, branches and mentions of GitHub issues, keyed by "owner/repo#number". */
  development: (refs: ZotzIssueRef[]) => Promise<Record<string, ZotzTaskDevelopment>>
  /** The GitHub login gh is signed in as, for `assignee:@me`. */
  viewer: () => Promise<string | null>
  /** The signed-in account and its organizations, with or without Projects. */
  owners: () => Promise<{ login: string; ownerType: 'organization' | 'user' }[]>
  /** An owner's repos, for choosing repos without a Project. */
  listOwnerRepos: (
    owner: string,
    ownerType: 'organization' | 'user'
  ) => Promise<{ ok: true; repos: string[] } | { ok: false; error: string }>
  /** Recent open and closed issues of these repos. */
  repoIssues: (repos: string[]) => Promise<ZotzRepoIssues[]>
  /** Links a PR that only mentioned a task and sends link-pr. */
  linkPullRequest: (
    id: string,
    taskId: string,
    url: string
  ) => Promise<ZotzTaskConnectorSnapshot | null>
}
