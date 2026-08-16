// ── Retainer value ────────────────────────────────────────────────────────────
//
// How much a client engagement has been worth, derived from the monthly retainer
// and how long the engagement has run.
//
// Deliberately free of any Convex or React import so the arithmetic can be
// tested directly — this produces numbers people will put in invoices and
// year-end summaries, and an off-by-one month is a real amount of money.

export interface RetainerSource {
  monthlyRetainer?: number
  currency?: string
  startDate?: string
  endDate?: string
  status?: string
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
  if (!client.monthlyRetainer || !client.startDate) return null

  const months = monthsBilled(client.startDate, client.endDate, asOf)
  if (months === 0) return null

  return client.monthlyRetainer * months
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

/**
 * What each piece of content effectively cost the client.
 *
 * The number a DevRel gets asked for at renewal time. Null when either side is
 * missing — dividing by zero pieces would report Infinity, and a client with a
 * retainer but nothing logged yet should read as "—", not as infinitely
 * expensive.
 */
export function costPerPiece(
  client: RetainerSource,
  pieceCount: number,
  asOf: Ymd = todayYmd(),
): number | null {
  const billed = totalBilled(client, asOf)
  if (billed === null || pieceCount <= 0) return null

  return Math.round(billed / pieceCount)
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
