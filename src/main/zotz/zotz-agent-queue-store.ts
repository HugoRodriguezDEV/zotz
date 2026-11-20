import { join } from 'node:path'
import { SerialJsonWriter, readJsonFile } from './zotz-json-file'
import {
  createZotzAgentQueue,
  normalizeZotzAgentQueue,
  type ZotzAgentQueue
} from '../../shared/zotz/agent-queue/zotz-agent-queue'
import {
  normalizeZotzAgentMemoryLedger,
  type ZotzAgentMemoryLedger
} from '../../shared/zotz/agent-queue/zotz-agent-memory-ledger'

const QUEUE_FILE = 'zotz-agent-queue.json'
const LEDGER_FILE = 'zotz-agent-memory-ledger.json'

/** Keeps the agent backlog and the memory ledger on disk so queued tasks survive restarts. */
export class ZotzAgentQueueStore {
  private readonly writer = new SerialJsonWriter()

  constructor(private readonly userDataPath: string) {}

  async loadQueue(): Promise<ZotzAgentQueue> {
    const stored = await readJsonFile(join(this.userDataPath, QUEUE_FILE))
    return stored === undefined ? createZotzAgentQueue() : normalizeZotzAgentQueue(stored)
  }

  async loadLedger(): Promise<ZotzAgentMemoryLedger> {
    return normalizeZotzAgentMemoryLedger(await readJsonFile(join(this.userDataPath, LEDGER_FILE)))
  }

  saveQueue(queue: ZotzAgentQueue): Promise<void> {
    return this.writer.write(join(this.userDataPath, QUEUE_FILE), queue)
  }

  saveLedger(ledger: ZotzAgentMemoryLedger): Promise<void> {
    return this.writer.write(join(this.userDataPath, LEDGER_FILE), ledger)
  }
}
