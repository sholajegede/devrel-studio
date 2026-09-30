export interface TrackerRow {
  stage: string
  history: { stage: string; at: number }[]
  nextStepAt?: number | null
  updatedAt: number
}

const DAY = 24 * 60 * 60 * 1000
const RESPONSE = new Set(['screening', 'interview', 'offer', 'accepted', 'rejected'])
const INTERVIEW = new Set(['interview', 'offer', 'accepted'])
const OFFER = new Set(['offer', 'accepted'])

function reached(row: TrackerRow, stages: Set<string>): boolean {
  return stages.has(row.stage) || row.history.some((entry) => stages.has(entry.stage))
}

function appliedAt(row: TrackerRow): number | null {
  return row.history.find((entry) => entry.stage === 'applied')?.at ?? null
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

export function trackerStats(rows: TrackerRow[], now: number = Date.now()) {
  const applied = rows.filter((row) => appliedAt(row) !== null || row.stage !== 'saved')
  const responded = applied.filter((row) => reached(row, RESPONSE))
  const interviews = applied.filter((row) => reached(row, INTERVIEW))
  const offers = applied.filter((row) => reached(row, OFFER))

  const responseDays = responded
    .map((row) => {
      const start = appliedAt(row) ?? row.history[0]?.at
      const first = row.history.find((entry) => RESPONSE.has(entry.stage))?.at
      return start && first && first >= start ? Math.round((first - start) / DAY) : null
    })
    .filter((value): value is number => value !== null)

  const active = rows.filter((row) => ['applied', 'screening', 'interview', 'offer'].includes(row.stage))
  const needsFollowUp = rows.filter(
    (row) => ['applied', 'screening'].includes(row.stage) && now - row.updatedAt > 10 * DAY,
  )
  const upcoming = rows
    .filter((row) => row.nextStepAt && row.nextStepAt >= now - DAY && row.nextStepAt <= now + 7 * DAY)
    .sort((a, b) => (a.nextStepAt ?? 0) - (b.nextStepAt ?? 0))

  return {
    total: rows.length,
    applied: applied.length,
    active: active.length,
    responded: responded.length,
    interviews: interviews.length,
    offers: offers.length,
    responseRate: applied.length ? responded.length / applied.length : null,
    interviewRate: applied.length ? interviews.length / applied.length : null,
    medianDaysToResponse: median(responseDays),
    needsFollowUp,
    upcoming,
  }
}
