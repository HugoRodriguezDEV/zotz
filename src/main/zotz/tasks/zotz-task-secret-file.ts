import { getSecretStore, hasSecretStore } from '../../../shared/secure-storage/secret-store'
import { SerialJsonWriter } from '../zotz-json-file'
import { readJsonRecord } from './zotz-task-connector-record'

/** Tokens sealed with the OS secret store in a 0600 JSON file, one entry per id. */
export class ZotzTaskSecretFile {
  private readonly writer = new SerialJsonWriter()
  // Read-modify-write one at a time so two saves never drop each other's token.
  private pending: Promise<unknown> = Promise.resolve()

  constructor(private readonly path: string) {}

  /** Returns false when the OS can't encrypt; the token is then never written in plain text. */
  set(id: string, token: string | null): Promise<boolean> {
    const next = this.pending.then(async () => {
      const secrets = await readJsonRecord(this.path)
      if (token) {
        if (!hasSecretStore() || !getSecretStore().isEncryptionAvailable()) {
          return false
        }
        secrets[id] = getSecretStore().encryptString(token).toString('base64')
      } else {
        delete secrets[id]
      }
      await this.writer.write(this.path, secrets, { mode: 0o600 })
      return true
    })
    this.pending = next.catch(() => undefined)
    return next
  }

  async read(id: string): Promise<string | null> {
    const sealed = (await readJsonRecord(this.path))[id]
    if (typeof sealed !== 'string' || !hasSecretStore()) {
      return null
    }
    try {
      return getSecretStore().decryptString(Buffer.from(sealed, 'base64'))
    } catch {
      return null
    }
  }
}
