// ── Retainer value ────────────────────────────────────────────────────────────
//
// How much a client engagement has been worth, derived from the monthly retainer
// and how long the engagement has run.
//
// Deliberately free of any Convex or React import so the arithmetic can be
// tested directly — this produces numbers people will put in invoices and
// year-end summaries, and an off-by-one month is a real amount of money.

/** One rate, and the first billing date it applies to. */
export interface RateChange {
  amount: number
  /** `YYYY-MM-DD`. */
  effectiveFrom: string
  note?: string
  recordedAt?: string
}

/** A stretch where the engagement was on hold. An open `to` means still paused. */
export interface PausePeriod {
  from: string
  to?: string
  note?: string
  recordedAt?: string
}

export interface RetainerSource {
  monthlyRetainer?: number
  currency?: string
  startDate?: string
  endDate?: string
  status?: string
  /** Complete rate timeline, oldest first. Absent means the rate never changed. */
  rateHistory?: RateChange[]
  /** Stretches on hold. Billing dates falling inside one are not charged. */
  pausePeriods?: PausePeriod[]
}

/**
 * Whether a date falls inside a pause.
 *
 * Inclusive of `from` and exclusive of `to`: the day a client resumes is a
 * working day, and treating it as still paused would drop a month of billing
 * whenever a resume happened to land on an anniversary.
 */
export function isPausedOn(pauses: PausePeriod[] | undefined, date: Ymd): boolean {
  if (!pauses?.length) return false

  return pauses.some((pause) => {
    const from = parseYmd(pause.from)
    if (!from || compare(date, from) < 0) return false

    const to = parseYmd(pause.to)
    // No end recorded: the pause is still running.
    if (!to) return true
    return compare(date, to) < 0
  })
}

/** The pause currently running, if any. */
export function openPause(client: RetainerSource): PausePeriod | null {
  return (client.pausePeriods ?? []).find((pause) => !pause.to) ?? null
}

interface Ymd {
  y: number
  m: number
  d: number
}

/**
 * Parse a `YYYY-MM-DD` string into plain numbers.
 *
 * Deliberately not `new Date(...)`: that parses a bare date as UTC midnight,
 * which in any timezone behind UTC reads back as the previous day and shifts
 * every month boundary by one. These are calendar dates, not instants.
 */
function parseYmd(iso?: string): Ymd | null {
  if (!iso) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim())
  if (!match) return null

  const [, y, m, d] = match
  const parsed = { y: Number(y), m: Number(m), d: Number(d) }
  if (parsed.m < 1 || parsed.m > 12 || parsed.d < 1 || parsed.d > 31) return null

  return parsed
}

function todayYmd(): Ymd {
  const now = new Date()
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() }
}

function compare(a: Ymd, b: Ymd): number {
  return a.y - b.y || a.m - b.m || a.d - b.d
}

/** Whole month anniversaries between two dates. Negative if `to` precedes `from`. */
function monthsElapsed(from: Ymd, to: Ymd): number {
  const months = (to.y - from.y) * 12 + (to.m - from.m)
  // The anniversary day has not come round yet this month.
  return to.d < from.d ? months - 1 : months
}

/**
 * Number of monthly payments due between the start date and `asOf`.
 *
 * A retainer is charged upfront on the anniversary day, so the first payment
 * falls on the start date itself — a client signed today has been billed once,
 * not zero times. That is why this is elapsed months *plus one*.
 *
 * An engagement that has ended stops accruing at its end date. One that has not
 * started yet returns 0 rather than a negative count.
 */
export function monthsBilled(
  startDate?: string,
  endDate?: string,
  asOf: Ymd = todayYmd(),
): number {
  const start = parseYmd(startDate)
  if (!start) return 0

  const end = parseYmd(endDate)
  // Whichever comes first: the end of the engagement, or now.
  const until = end && compare(end, asOf) < 0 ? end : asOf

  if (compare(until, start) < 0) return 0

  return monthsElapsed(start, until) + 1
}

/**
 * Total billed to date: the monthly retainer times the number of months.
 *
 * Returns null rather than 0 when there is nothing to compute from, so the UI
 * can say "no retainer set" instead of showing a confident $0.
 *
 * A caveat worth stating plainly, because the number looks more precise than it
 * is: `Paused` engagements have no pause date recorded anywhere, so a pause is
 * not deducted. For a paused client this is what they *would* have been billed
 * had the engagement run continuously. The UI labels it as an estimate.
 */
export function totalBilled(
  client: RetainerSource,
  asOf: Ymd = todayYmd(),
): number | null {
  const segments = billingSegments(client, asOf)
  if (!segments.length) return null

  return segments.reduce((sum, segment) => sum + segment.subtotal, 0)
}

/**
 * The rate timeline, oldest first and validated.
 *
 * Entries with an unparseable date are dropped rather than guessed at, and the
 * list is sorted here so callers never depend on insertion order.
 */
function ratePeriods(client: RetainerSource): { from: Ymd; amount: number }[] {
  const history = (client.rateHistory ?? [])
    .map((change) => ({ from: parseYmd(change.effectiveFrom), amount: change.amount }))
    .filter((entry): entry is { from: Ymd; amount: number } => entry.from !== null)
    .sort((a, b) => compare(a.from, b.from))

  if (history.length) return history

  // No history recorded: the current rate has applied for the whole engagement,
  // which is how this worked before rate changes were tracked.
  const start = parseYmd(client.startDate)
  if (!start || !client.monthlyRetainer) return []
  return [{ from: start, amount: client.monthlyRetainer }]
}

/** Advance a calendar date by `count` whole months, keeping the day of month. */
function addMonths(date: Ymd, count: number): Ymd {
  const zeroBased = date.m - 1 + count
  return {
    y: date.y + Math.floor(zeroBased / 12),
    m: ((zeroBased % 12) + 12) % 12 + 1,
    d: date.d,
  }
}

export interface BillingSegment {
  amount: number
  months: number
  subtotal: number
  /** First billing date charged at this amount. */
  from: Ymd
}

/**
 * The engagement broken into runs of months billed at the same rate.
 *
 * Walks the actual billing dates — the start date and each monthly anniversary —
 * and charges whichever rate was in effect on each one. Multiplying a single
 * rate by a month count cannot express a raise partway through, which is the
 * whole point of tracking history.
 *
 * A rate whose `effectiveFrom` falls between two anniversaries takes effect on
 * the next billing date, not immediately: the month already charged was charged
 * at the old rate, and no money changes hands mid-period.
 */
export function billingSegments(
  client: RetainerSource,
  asOf: Ymd = todayYmd(),
): BillingSegment[] {
  const start = parseYmd(client.startDate)
  if (!start) return []

  const periods = ratePeriods(client)
  if (!periods.length) return []

  const months = monthsBilled(client.startDate, client.endDate, asOf)
  if (months === 0) return []

  const segments: BillingSegment[] = []

  for (let index = 0; index < months; index++) {
    const billingDate = addMonths(start, index)

    // On hold: no invoice went out for this month, so it contributes nothing.
    // Skipping the occurrence rather than charging zero also keeps the segment
    // boundaries meaningful — a pause splits a run rather than flattening it.
    if (isPausedOn(client.pausePeriods, billingDate)) continue

    // The newest rate that had taken effect by this billing date. Falls back to
    // the earliest known rate for months preceding any recorded change.
    let amount = periods[0].amount
    for (const period of periods) {
      if (compare(period.from, billingDate) <= 0) amount = period.amount
      else break
    }

    const current = segments[segments.length - 1]
    if (current && current.amount === amount) {
      current.months += 1
      current.subtotal += amount
    } else {
      segments.push({ amount, months: 1, subtotal: amount, from: billingDate })
    }
  }

  return segments
}

/**
 * Months actually invoiced, pauses excluded.
 *
 * Distinct from `monthsBilled`, which counts anniversaries elapsed and is what
 * tenure is measured in — a client paused for two months is still ten months
 * into the relationship, but has only paid for eight.
 */
export function monthsCharged(
  client: RetainerSource,
  asOf: Ymd = todayYmd(),
): number {
  return billingSegments(client, asOf).reduce(
    (total, segment) => total + segment.months,
    0,
  )
}

/** Months skipped because the engagement was on hold. */
export function monthsPaused(
  client: RetainerSource,
  asOf: Ymd = todayYmd(),
): number {
  const elapsed = monthsBilled(client.startDate, client.endDate, asOf)
  return Math.max(0, elapsed - monthsCharged(client, asOf))
}

/** The rate being charged as of `asOf` — the newest one that has taken effect. */
export function currentRate(
  client: RetainerSource,
  asOf: Ymd = todayYmd(),
): number | null {
  const periods = ratePeriods(client)
  if (!periods.length) return null

  let amount: number | null = null
  for (const period of periods) {
    if (compare(period.from, asOf) <= 0) amount = period.amount
    else break
  }
  // Every recorded rate is still in the future: nothing is being charged yet.
  return amount
}

/** Sum of `totalBilled` across many clients. Clients without a retainer contribute 0. */
export function totalBilledAcross(
  clients: readonly RetainerSource[],
  asOf: Ymd = todayYmd(),
): number {
  return clients.reduce((sum, client) => sum + (totalBilled(client, asOf) ?? 0), 0)
}

/** "3 months", "1 yr 4 mo", "2 yrs" — how long the engagement has run. */
export function tenureLabel(
  startDate?: string,
  endDate?: string,
  asOf: Ymd = todayYmd(),
): string | null {
  const months = monthsBilled(startDate, endDate, asOf)
  if (months === 0) return null

  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`

  const years = Math.floor(months / 12)
  const rest = months % 12
  const yearPart = `${years} yr${years === 1 ? '' : 's'}`

  return rest === 0 ? yearPart : `${yearPart} ${rest} mo`
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
  CAD: 'C$',
  AUD: 'A$',
}

export function currencySymbol(currency?: string): string {
  return CURRENCY_SYMBOLS[currency ?? 'USD'] ?? '$'
}

/** `$12,000` — whole units, since retainers are not billed in cents. */
export function formatMoney(amount: number, currency?: string): string {
  return `${currencySymbol(currency)}${Math.round(amount).toLocaleString()}`
}
