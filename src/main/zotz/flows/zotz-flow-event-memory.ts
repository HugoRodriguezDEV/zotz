import { join } from 'node:path'
import { z } from 'zod'
import { readJsonFile, SerialJsonWriter } from '../zotz-json-file'

const FILE = 'zotz-flow-events.json'
// Far more than a busy repo's events in the window a source can still report again.
const MAX_SEEN = 5000

const MemoryFileSchema = z
  .object({
    seen: z.record(z.string(), z.number()).catch({}),
    baselines: z.record(z.string(), z.number()).catch({})
  })
  .catch({ seen: {}, baselines: {} })

/**
 * Events already handled, kept on disk so a restart never fires them again, and when each
 * polled source was first read: what happened before that is history, not news.
 */
export class ZotzFlowEventMemory {
  private seen = new Map<string, number>()
  private baselines = new Map<string, number>()
  private readonly writer = new SerialJsonWriter()
  private readonly path: string

  constructor(userDataPath: string) {
    this.path = join(userDataPath, FILE)
  }

  async load(): Promise<void> {
    const file = MemoryFileSchema.parse(await readJsonFile(this.path))
    this.seen = new Map(Object.entries(file.seen))
    this.baselines = new Map(Object.entries(file.baselines))
  }

  /** True the first time a key is seen; it is remembered from then on. */
  claim(key: string, at: number): boolean {
    if (this.seen.has(key)) {
      return false
    }
    this.seen.set(key, at)
    if (this.seen.size > MAX_SEEN) {
      const oldest = [...this.seen.entries()].sort((a, b) => a[1] - b[1])
      this.seen = new Map(oldest.slice(oldest.length - MAX_SEEN))
    }
    this.save()
    return true
  }

  /** When this source was first read; set to `now` on the first call. */
  baseline(key: string, now: number): number {
    const known = this.baselines.get(key)
    if (known !== undefined) {
      return known
    }
    this.baselines.set(key, now)
    this.save()
    return now
  }

  async flush(): Promise<void> {
    await this.writer
      .write(this.path, this.snapshot())
      .catch((error) => console.error('[zotz-flows] could not save seen events:', error))
  }

  private snapshot() {
    return {
      version: 1,
      seen: Object.fromEntries(this.seen),
      baselines: Object.fromEntries(this.baselines)
    }
  }

  private save(): void {
    void this.flush()
  }
}
