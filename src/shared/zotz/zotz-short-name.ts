export const ZOTZ_SHORT_NAME_MAX_LENGTH = 32

export type ZotzShortNameSetResult =
  | { ok: true; names: Record<string, string> }
  | { ok: false; reason: 'invalid' | 'taken'; names: Record<string, string> }

/** Lowercase ASCII words joined by `-`, so agents can type it: `Mi Proyecto` → `mi-proyecto`. */
export function normalizeZotzShortName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, ZOTZ_SHORT_NAME_MAX_LENGTH)
    .replace(/-+$/, '')
}

function pathBasename(path: string): string {
  const parts = path.split(/[\\/]+/).filter(Boolean)
  return parts.at(-1) ?? ''
}

/** A workspace's folder name; Windows and POSIX separators both count. */
export function defaultZotzShortName(path: string): string {
  return normalizeZotzShortName(pathBasename(path)) || 'workspace'
}

/**
 * Effective short name of every workspace on one host, by path. Custom names win; a default that
 * collides takes the next free `-2`, `-3`… Paths are sorted so every client of the host agrees.
 */
export function resolveZotzShortNames(
  paths: readonly string[],
  custom: Readonly<Record<string, string>>
): Map<string, string> {
  const sorted = [...new Set(paths)].sort()
  const result = new Map<string, string>()
  const taken = new Set<string>()
  for (const path of sorted) {
    const name = custom[path] ? normalizeZotzShortName(custom[path]) : ''
    if (name && !taken.has(name)) {
      result.set(path, name)
      taken.add(name)
    }
  }
  for (const path of sorted) {
    if (result.has(path)) {
      continue
    }
    const base = defaultZotzShortName(path)
    let name = base
    for (let suffix = 2; taken.has(name); suffix++) {
      name = `${base}-${suffix}`
    }
    result.set(path, name)
    taken.add(name)
  }
  return result
}
