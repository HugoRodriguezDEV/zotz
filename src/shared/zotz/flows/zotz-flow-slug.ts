/** `Revisar PR` → `revisar-pr`; the chat command and CLI address flows by it. */
export function zotzFlowSlugFromName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '')
  return slug || 'flow'
}

/** Slug of `name`, numbered (`-2`, `-3`…) until no flow in `taken` uses it. */
export function uniqueZotzFlowSlug(name: string, taken: readonly string[]): string {
  const base = zotzFlowSlugFromName(name)
  let slug = base
  for (let index = 2; taken.includes(slug); index += 1) {
    slug = `${base}-${index}`
  }
  return slug
}
