// ── Platform stats ────────────────────────────────────────────────────────────
//
// A client cannot open the DevRel's Dev.to, Medium or Hashnode dashboards, so
// each month's report carries the platform's own totals and the screenshot or
// export they came from. These rules are shared by the Stats page, the monthly
// reminder and the report.
//
// No imports, so this runs in Convex functions, the browser and tests alike.

/** Platforms whose numbers only the DevRel can see. */
export const STATS_PLATFORMS = ['Dev.to', 'Medium', 'Hashnode'] as const
export type StatsPlatform = (typeof STATS_PLATFORMS)[number]

export function isStatsPlatform(platform: string): platform is StatsPlatform {
  return (STATS_PLATFORMS as readonly string[]).includes(platform)
}

/** Screenshots and exports. Nothing else is accepted as evidence. */
export const EVIDENCE_TYPES = ['image/png', 'image/jpeg', 'text/csv', 'application/pdf'] as const

/** 8 MB. A screenshot is a few hundred KB; this leaves room for a PDF export. */
export const EVIDENCE_MAX_BYTES = 8 * 1024 * 1024

export function isEvidenceType(contentType: string | null | undefined): boolean {
  return !!contentType && (EVIDENCE_TYPES as readonly string[]).includes(contentType)
}

/** `YYYY-MM` for a date, in UTC. */
export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

/** The month before `month`, as `YYYY-MM`. */
export function previousMonth(month: string): string {
  const [year, mon] = month.split('-').map(Number)
  return mon === 1 ? `${year - 1}-12` : `${year}-${String(mon - 1).padStart(2, '0')}`
}

/** True for a well-formed `YYYY-MM`. */
export function isMonthKey(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

/** "November 2026" for `2026-11`. */
export function monthLabel(month: string): string {
  const [year, mon] = month.split('-').map(Number)
  return new Date(Date.UTC(year, mon - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * The platforms a client publishes on, among the ones that need evidence.
 *
 * Read from the client's entries, so a client who has never had a Medium piece
 * is never asked for Medium numbers.
 */
export function platformsInUse(entries: Array<{ platform?: string | null }>): StatsPlatform[] {
  const used = new Set(entries.map((entry) => entry.platform ?? ''))
  return STATS_PLATFORMS.filter((platform) => used.has(platform))
}

/** Platforms in use that have no evidence file for the month. */
export function missingEvidence(
  platforms: readonly StatsPlatform[],
  rows: Array<{ platform: string; evidenceStorageId?: string | null }>,
): StatsPlatform[] {
  const done = new Set(rows.filter((row) => row.evidenceStorageId).map((row) => row.platform))
  return platforms.filter((platform) => !done.has(platform))
}

/**
 * How far the platform's own total is from the sum of the entry view counts.
 *
 * Returns the difference as a fraction of the platform total, or null when
 * either side is missing. The report flags anything over `GAP_THRESHOLD`,
 * because the two should tell the same story and a large gap is a question a
 * client will ask.
 */
export function viewGap(platformTotal: number | null | undefined, entryTotal: number | null | undefined): number | null {
  if (platformTotal == null || entryTotal == null || platformTotal <= 0) return null
  return Math.abs(platformTotal - entryTotal) / platformTotal
}

export const GAP_THRESHOLD = 0.1
