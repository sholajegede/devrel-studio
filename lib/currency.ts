import { PLANS, type PlanDefinition, type PlanId, type Term } from '@/convex/model/plans'

// ── Local pricing ─────────────────────────────────────────────────────────────
//
// Each currency carries its own price list. Nothing here converts at a live
// rate, and that is deliberate: every payment is collected by bank transfer, so
// the figure on the page has to be the figure that arrives. A rate pulled at
// render time drifts between the moment someone reads the price and the moment
// they reach their banking app, and the difference turns into an email we have
// to settle by hand. Fixed local prices are also what Spotify, Figma and Notion
// do, for the same reason.
//
// The consequence to accept: when the naira moves, these numbers do not. They
// are a business decision, not a calculation, so they are reviewed by hand.
// The USD column is the anchor; the others were set from it at the rates noted
// below and rounded to figures that read like prices rather than conversions.
//
//   Set August 2026 at ~£0.79 and ~₦1,550 to the dollar.
//
// Anyone revisiting these should change the numbers, not add a conversion.

export type CurrencyCode = 'USD' | 'GBP' | 'NGN'

export interface Currency {
  code: CurrencyCode
  symbol: string
  /** Monthly price per plan, in whole units. Free is 0 in every currency. */
  monthly: Record<PlanId, number>
  /**
   * Smallest step a displayed total is rounded to. Naira prices in the tens of
   * thousands should not end in stray digits after a term discount.
   */
  step: number
}

export const CURRENCIES: Record<CurrencyCode, Currency> = {
  USD: {
    code: 'USD',
    symbol: '$',
    monthly: { free: 0, starter: 29, pro: 59, agency: 119 },
    step: 1,
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    monthly: { free: 0, starter: 23, pro: 47, agency: 95 },
    step: 1,
  },
  NGN: {
    code: 'NGN',
    symbol: '₦',
    monthly: { free: 0, starter: 45_000, pro: 90_000, agency: 180_000 },
    step: 100,
  },
}

export const DEFAULT_CURRENCY: CurrencyCode = 'USD'

/**
 * Country to currency.
 *
 * Only three countries get their own price list, so this names those and lets
 * everywhere else fall to dollars. Failing to dollars is the safe direction:
 * a reader who sees USD understands the number, while a reader shown the wrong
 * local currency is misinformed about what to send.
 */
export function currencyForCountry(country: string | null | undefined): CurrencyCode {
  switch (country?.trim().toUpperCase()) {
    case 'GB':
      return 'GBP'
    case 'NG':
      return 'NGN'
    default:
      return DEFAULT_CURRENCY
  }
}

/**
 * Time zone to currency, for the client side where no geo header exists.
 *
 * Deliberately narrow. It recognises the two zones that map to a non-dollar
 * price list and treats everything else as dollars, rather than trying to guess
 * a country from a zone in general.
 */
export function currencyForTimeZone(timeZone: string | null | undefined): CurrencyCode {
  const zone = timeZone?.trim()
  if (!zone) return DEFAULT_CURRENCY
  if (zone === 'Africa/Lagos') return 'NGN'
  if (zone === 'Europe/London' || zone === 'Europe/Belfast') return 'GBP'
  return DEFAULT_CURRENCY
}

/**
 * Both of these test membership with `hasOwnProperty` rather than `in`, because
 * `in` walks the prototype chain: `'constructor' in CURRENCIES` is true, and the
 * value under test arrives from a query string.
 */
export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, value)
}

/** Reads an explicit `?currency=` override. Anything unrecognised is ignored. */
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

/**
 * Renders an amount with its symbol and thousands separators.
 *
 * Naira totals run to six figures, so the separators are not decoration. Whole
 * units throughout: no plan price has ever had a fractional part, and showing
 * ₦45,000.00 would only add noise.
 */
export function formatPrice(amount: number, currency: CurrencyCode): string {
  return `${CURRENCIES[currency].symbol}${amount.toLocaleString('en-US')}`
}

/**
 * The line a buyer puts in a transfer request.
 *
 * Carries the code as well as the symbol. "£95" alone is unambiguous, but a
 * payment instruction that names the currency leaves a bank with nothing to
 * interpret.
 */
export function priceWithCode(amount: number, currency: CurrencyCode): string {
  return `${formatPrice(amount, currency)} ${currency}`
}

/** Plan name and local monthly price, for headings and email subjects. */
export function planPriceLabel(id: PlanId, currency: CurrencyCode): string {
  return `${PLANS[id].name} ${formatPrice(monthlyPrice(id, currency), currency)}/month`
}
