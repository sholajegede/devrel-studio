import { describe, expect, it } from 'vitest'
import {
  CURRENCIES,
  isCurrencyCode,
  currencyForCountry,
  currencyForTimeZone,
  formatPrice,
  monthlyPrice,
  parseCurrency,
  priceWithCode,
  termMonthlyIn,
  termPriceIn,
} from '@/lib/currency'
import { PLAN_IDS, PURCHASABLE_PLANS, TERMS } from '@/convex/model/plans'

describe('currencyForCountry', () => {
  it('gives each named country its own price list', () => {
    expect(currencyForCountry('GB')).toBe('GBP')
    expect(currencyForCountry('NG')).toBe('NGN')
    expect(currencyForCountry('US')).toBe('USD')
  })

  it('accepts whatever case the header arrives in', () => {
    expect(currencyForCountry('ng')).toBe('NGN')
    expect(currencyForCountry(' gb ')).toBe('GBP')
  })

  // A missing geo header is the normal case off Vercel, including local dev.
  it('falls back to dollars when the country is unknown', () => {
    expect(currencyForCountry(null)).toBe('USD')
    expect(currencyForCountry(undefined)).toBe('USD')
    expect(currencyForCountry('')).toBe('USD')
    expect(currencyForCountry('ZZ')).toBe('USD')
  })

  // Showing a Kenyan or Ghanaian reader naira would tell them to send the wrong
  // money. Everywhere unnamed has to land on dollars.
  it('does not spread naira across the rest of Africa', () => {
    for (const country of ['KE', 'GH', 'ZA', 'EG']) {
      expect(currencyForCountry(country)).toBe('USD')
    }
  })

  it('does not spread sterling across the rest of Europe', () => {
    for (const country of ['IE', 'FR', 'DE', 'ES']) {
      expect(currencyForCountry(country)).toBe('USD')
    }
  })
})

describe('currencyForTimeZone', () => {
  it('recognises the two zones with their own price list', () => {
    expect(currencyForTimeZone('Africa/Lagos')).toBe('NGN')
    expect(currencyForTimeZone('Europe/London')).toBe('GBP')
  })

  it('falls back to dollars everywhere else', () => {
    expect(currencyForTimeZone('America/New_York')).toBe('USD')
    expect(currencyForTimeZone('Africa/Nairobi')).toBe('USD')
    expect(currencyForTimeZone('Europe/Dublin')).toBe('USD')
    expect(currencyForTimeZone(undefined)).toBe('USD')
  })
})

describe('parseCurrency', () => {
  it('reads an explicit override', () => {
    expect(parseCurrency('NGN')).toBe('NGN')
    expect(parseCurrency('gbp')).toBe('GBP')
  })

  // The override arrives from a query string, so it is attacker-controlled and
  // must never widen the set of currencies the app believes in.
  it('rejects anything not on the list', () => {
    expect(parseCurrency('EUR')).toBeNull()
    expect(parseCurrency('')).toBeNull()
    expect(parseCurrency(null)).toBeNull()
    expect(parseCurrency('__proto__')).toBeNull()
    expect(parseCurrency('constructor')).toBeNull()
  })

  // `in` walks the prototype chain, so a bare membership test would accept
  // 'constructor' and hand the rest of the app a currency that does not exist.
  it('does not mistake an inherited property for a currency', () => {
    expect(isCurrencyCode('constructor')).toBe(false)
    expect(isCurrencyCode('toString')).toBe(false)
    expect(isCurrencyCode('__proto__')).toBe(false)
    expect(isCurrencyCode('USD')).toBe(true)
  })
})

describe('price lists', () => {
  it('prices every plan in every currency', () => {
    for (const currency of Object.values(CURRENCIES)) {
      for (const id of PLAN_IDS) {
        expect(typeof currency.monthly[id]).toBe('number')
      }
    }
  })

  it('keeps the trial free everywhere', () => {
    for (const code of ['USD', 'GBP', 'NGN'] as const) {
      expect(monthlyPrice('free', code)).toBe(0)
    }
  })

  // A cheaper plan that costs more than a dearer one in some currency would be
  // a typo nobody notices until a customer points at it.
  it('keeps the plans in the same order in every currency', () => {
    for (const code of ['USD', 'GBP', 'NGN'] as const) {
      const prices = PURCHASABLE_PLANS.map((id) => monthlyPrice(id, code))
      const ascending = [...prices].sort((a, b) => a - b)
      expect(prices).toEqual(ascending)
    }
  })
})

describe('term pricing', () => {
  it('charges the flat multiple when a term carries no discount', () => {
    const oneMonth = TERMS[0]
    expect(oneMonth.discount).toBe(0)
    expect(termPriceIn('pro', oneMonth, 'USD')).toBe(59)
    expect(termPriceIn('pro', oneMonth, 'NGN')).toBe(90_000)
  })

  it('applies the discount to the whole term', () => {
    const year = TERMS.find((t) => t.months === 12)!
    expect(year.discount).toBe(20)
    // 59 × 12 = 708, less 20%
    expect(termPriceIn('pro', year, 'USD')).toBe(566)
    expect(termPriceIn('pro', year, 'NGN')).toBe(864_000)
  })

  // Naira totals run to six figures, so a discount must not leave a price
  // ending in stray naira.
  it('rounds naira totals to a round figure', () => {
    for (const id of PURCHASABLE_PLANS) {
      for (const term of TERMS) {
        expect(termPriceIn(id, term, 'NGN') % 100).toBe(0)
      }
    }
  })

  it('never quotes a longer term above the price of a shorter one', () => {
    for (const code of ['USD', 'GBP', 'NGN'] as const) {
      for (const id of PURCHASABLE_PLANS) {
        const rates = TERMS.map((term) => termMonthlyIn(id, term, code))
        const descending = [...rates].sort((a, b) => b - a)
        expect(rates).toEqual(descending)
      }
    }
  })

  it('reports an effective monthly rate below the list price on a discount', () => {
    const year = TERMS.find((t) => t.months === 12)!
    expect(termMonthlyIn('starter', year, 'USD')).toBeLessThan(monthlyPrice('starter', 'USD'))
    expect(termMonthlyIn('starter', year, 'NGN')).toBeLessThan(monthlyPrice('starter', 'NGN'))
  })
})

describe('formatting', () => {
  it('puts the right symbol on the front', () => {
    expect(formatPrice(29, 'USD')).toBe('$29')
    expect(formatPrice(23, 'GBP')).toBe('£23')
    expect(formatPrice(45_000, 'NGN')).toBe('₦45,000')
  })

  it('separates thousands so six-figure totals stay readable', () => {
    expect(formatPrice(864_000, 'NGN')).toBe('₦864,000')
  })

  // The bank instruction has to name the currency: a Nigerian bank shown "$566"
  // and a US bank shown "₦566" both need telling which one they are handling.
  it('names the currency on a payment instruction', () => {
    expect(priceWithCode(566, 'USD')).toBe('$566 USD')
    expect(priceWithCode(864_000, 'NGN')).toBe('₦864,000 NGN')
  })
})
