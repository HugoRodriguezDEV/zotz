import { join } from 'node:path'
import { isJsonRecord } from '../zotz-json-record'
import { SerialJsonWriter, readJsonFile } from '../zotz-json-file'
import type { ZotzLinkPeer } from '../../../shared/zotz/conversation-links/zotz-conversation-links-contract'
import { getCanonicalUserDataPath } from '../../persistence/loading-store/user-data-path'
import { runtimePathsEqual } from '../../runtime/workspaces/catalog/runtime-worktree-path-identity'

const LINK_PEERS_FILE = 'zotz-link-peers.json'
const REACHES = new Set<ZotzLinkPeer['reach']>(['direct', 'on-server', 'reply-only'])

/** One worktree's partners; `changedAt` moves only when they change, so each change is told once. */
export type ZotzLinkPeerEntry = { peers: ZotzLinkPeer[]; changedAt: number }

export type ZotzLinkPeerChange = {
  previous: ZotzLinkPeerEntry | null
  current: ZotzLinkPeerEntry | null
  changed: boolean
}

function readPeer(value: unknown): ZotzLinkPeer | null {
  if (
    !isJsonRecord(value) ||
    typeof value.shortName !== 'string' ||
    typeof value.title !== 'string' ||
    !(typeof value.machine === 'string' || value.machine === null) ||
    !REACHES.has(value.reach as ZotzLinkPeer['reach'])
  ) {
    return null
  }
  return {
    shortName: value.shortName,
    title: value.title,
    machine: value.machine,
    reach: value.reach as ZotzLinkPeer['reach']
  }
}

function readLinks(stored: unknown): Record<string, ZotzLinkPeerEntry> {
  const links = isJsonRecord(stored) && isJsonRecord(stored.links) ? stored.links : {}
  const result: Record<string, ZotzLinkPeerEntry> = {}
  for (const [path, value] of Object.entries(links)) {
    if (!isJsonRecord(value) || !Array.isArray(value.peers)) {
      continue
    }
    const peers = value.peers.map(readPeer).filter((peer) => peer !== null)
    if (peers.length > 0) {
      result[path] = {
        peers,
        changedAt: typeof value.changedAt === 'number' ? value.changedAt : 0
      }
    }
  }
  return result
}

function samePeers(a: readonly ZotzLinkPeer[], b: readonly ZotzLinkPeer[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** The link partners of this host's worktrees, keyed by path; the UI's machine pushes them. */
export class ZotzLinkPeerStore {
  private readonly writer = new SerialJsonWriter()
  private links: Promise<Record<string, ZotzLinkPeerEntry>> | null = null

  constructor(private readonly filePath: string) {}

  private list(): Promise<Record<string, ZotzLinkPeerEntry>> {
    this.links ??= readJsonFile(this.filePath).then(readLinks)
    return this.links
  }

  async get(path: string): Promise<ZotzLinkPeerEntry | null> {
    const links = await this.list()
    const key =
      path in links ? path : Object.keys(links).find((other) => runtimePathsEqual(other, path))
    return key ? links[key] : null
  }

  async set(path: string, peers: ZotzLinkPeer[]): Promise<ZotzLinkPeerChange> {
    const current = await this.list()
    const previous = current[path] ?? null
    if (samePeers(previous?.peers ?? [], peers)) {
      return { previous, current: previous, changed: false }
    }
    const next = { ...current }
    const entry = peers.length > 0 ? { peers, changedAt: Date.now() } : null
    if (entry) {
      next[path] = entry
    } else {
      delete next[path]
    }
    this.links = Promise.resolve(next)
    await this.writer.write(this.filePath, { version: 1, links: next })
    return { previous, current: entry, changed: true }
  }
}

let store: ZotzLinkPeerStore | null = null

export function getZotzLinkPeerStore(): ZotzLinkPeerStore {
  store ??= new ZotzLinkPeerStore(join(getCanonicalUserDataPath(), LINK_PEERS_FILE))
  return store
}
