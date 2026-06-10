import type { AppArch, AppDTO, Leftover } from './protocol'

export interface Badge {
  label: string
  flagged: boolean // true => warn the user (Intel-only under Rosetta)
  tone: 'warn' | 'neutral' | 'accent' | 'muted'
}

export function archBadge(arch: AppArch): Badge {
  switch (arch) {
    case 'intel':
      return { label: 'Intel', flagged: true, tone: 'warn' }
    case 'appleSilicon':
      return { label: 'Apple Silicon', flagged: false, tone: 'accent' }
    case 'universal':
      return { label: 'Universal', flagged: false, tone: 'neutral' }
    default:
      return { label: 'Unknown', flagged: false, tone: 'muted' }
  }
}

// sortApps: Intel-only first (the actionable set), then everything else; within
// each group, largest first.
export function sortApps(apps: AppDTO[]): AppDTO[] {
  const rank = (a: AppDTO) => (a.arch === 'intel' ? 0 : 1)
  return [...apps].sort((a, b) => rank(a) - rank(b) || b.bytes - a.bytes)
}

export function uninstallTotal(app: AppDTO, leftovers: Leftover[], selected: Set<string>): number {
  return app.bytes + leftovers.filter((l) => selected.has(l.path)).reduce((n, l) => n + l.bytes, 0)
}

// matchesAppName: confident match between a query app name and an iTunes result
// track name — case-insensitive containment either way.
export function matchesAppName(query: string, trackName: string): boolean {
  const q = query.trim().toLowerCase()
  const t = trackName.trim().toLowerCase()
  if (!q || !t) return false
  return t.includes(q) || q.includes(t)
}
