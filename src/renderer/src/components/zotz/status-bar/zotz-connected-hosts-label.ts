/** Names the connected machines instead of counting them while they fit: "MSI Server · Mac mini". */
export function zotzConnectedHostsLabel(names: readonly string[]): string | null {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))]
  return unique.length > 0 && unique.length <= 2 ? unique.join(' · ') : null
}
