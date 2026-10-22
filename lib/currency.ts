import { PLANS, type PlanDefinition, type PlanId, type Term } from '@/convex/model/plans'

// ── Pricing ───────────────────────────────────────────────────────────────────
//
// Every price is in US dollars. One list, one currency, no conversion: the
// figure on the page is the figure on the invoice. The helpers keep a currency
// argument so callers read the same as before, and so a second list can be
// added later without touching them.

export type CurrencyCode = 'USD'

export interface Currency {
  code: CurrencyCode
  symbol: string
  /** Monthly price per plan, in whole dollars. Free is 0. */
  monthly: Record<PlanId, number>
  /** Smallest step a displayed total is rounded to. */
  step: number
}

export const CURRENCIES: Record<CurrencyCode, Currency> = {
  USD: {
    code: 'USD',
    symbol: '$',
    monthly: { free: 0, starter: 29, pro: 59, agency: 119 },
    step: 1,
  },
}

export const DEFAULT_CURRENCY: CurrencyCode = 'USD'

/** Kept for existing callers. Every country is billed in dollars. */
export function currencyForCountry(_country: string | null | undefined): CurrencyCode {
  return DEFAULT_CURRENCY
}

/** Kept for existing callers. Every time zone is billed in dollars. */
export function currencyForTimeZone(_timeZone: string | null | undefined): CurrencyCode {
  return DEFAULT_CURRENCY
}

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, value)
}

/** Reads a `?currency=` value. Only USD is recognised. */
export function parseCurrency(value: string | null | undefined): CurrencyCode | null {
  const code = value?.trim().toUpperCase()
  return code && isCurrencyCode(code) ? code : null
}

/** The monthly price of a plan in a currency, before any term discount. */
export function monthlyPrice(plan: PlanDefinition | PlanId, currency: CurrencyCode): number {
  const id = typeof plan === 'string' ? plan : plan.id
  return CURRENCIES[currency].monthly[id]
}

function roundTo(amount: number, step: number): number {
  return Math.round(amount / step) * step
}

/** What a whole term costs in a currency, discount applied. */
export function termPriceIn(
  plan: PlanDefinition | PlanId,
  term: Term,
  currency: CurrencyCode,
): number {
  const gross = monthlyPrice(plan, currency) * term.months * (1 - term.discount / 100)
  return roundTo(gross, CURRENCIES[currency].step)
}

/** The effective monthly rate on a term, which is what the discount is worth. */
export function termMonthlyIn(
  plan: PlanDefinition | PlanId,
  term: Term,
  currency: CurrencyCode,
): number {
  const per = termPriceIn(plan, term, currency) / term.months
  return roundTo(per, CURRENCIES[currency].step)
}

/** Renders an amount with its symbol and thousands separators, in whole dollars. */
export function formatPrice(amount: number, currency: CurrencyCode): string {
  return `${CURRENCIES[currency].symbol}${amount.toLocaleString('en-US')}`
}

/** The line a buyer puts in a payment request, with the currency code. */
export function priceWithCode(amount: number, currency: CurrencyCode): string {
  return `${formatPrice(amount, currency)} ${currency}`
}

/** Plan name and local monthly price, for headings and email subjects. */
export function planPriceLabel(id: PlanId, currency: CurrencyCode): string {
  return `${PLANS[id].name} ${formatPrice(monthlyPrice(id, currency), currency)}/month`
}
