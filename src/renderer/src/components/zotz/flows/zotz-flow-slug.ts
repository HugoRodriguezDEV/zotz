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
