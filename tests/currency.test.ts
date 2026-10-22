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

describe('currency resolution', () => {
  // Every price is in US dollars, whatever the country or time zone.
  it('bills every country and time zone in dollars', () => {
    for (const country of ['GB', 'NG', 'US', 'KE', 'DE', '', null, undefined]) {
      expect(currencyForCountry(country)).toBe('USD')
    }
    for (const zone of ['Africa/Lagos', 'Europe/London', 'America/New_York', undefined]) {
      expect(currencyForTimeZone(zone)).toBe('USD')
    }
  })

  it('offers dollars and nothing else', () => {
    expect(Object.keys(CURRENCIES)).toEqual(['USD'])
  })
})

describe('parseCurrency', () => {
  it('reads USD in any case', () => {
    expect(parseCurrency('USD')).toBe('USD')
    expect(parseCurrency(' usd ')).toBe('USD')
  })

  // The value arrives from a query string, so it is attacker-controlled and
  // must never widen the set of currencies the app believes in.
  it('rejects anything not on the list', () => {
    for (const value of ['NGN', 'GBP', 'EUR', '', null, '__proto__', 'constructor']) {
      expect(parseCurrency(value)).toBeNull()
    }
  })

  it('does not mistake an inherited property for a currency', () => {
    expect(isCurrencyCode('constructor')).toBe(false)
    expect(isCurrencyCode('toString')).toBe(false)
    expect(isCurrencyCode('__proto__')).toBe(false)
    expect(isCurrencyCode('USD')).toBe(true)
  })
})

describe('price list', () => {
  it('prices every plan', () => {
    for (const id of PLAN_IDS) {
      expect(typeof CURRENCIES.USD.monthly[id]).toBe('number')
    }
  })

  it('keeps the trial free', () => {
    expect(monthlyPrice('free', 'USD')).toBe(0)
  })

  it('keeps the plans in ascending order', () => {
    const prices = PURCHASABLE_PLANS.map((id) => monthlyPrice(id, 'USD'))
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
  })
})

describe('term pricing', () => {
  it('charges the flat multiple when a term carries no discount', () => {
    const oneMonth = TERMS[0]
    expect(oneMonth.discount).toBe(0)
    expect(termPriceIn('pro', oneMonth, 'USD')).toBe(59)
  })

  it('applies the discount to the whole term', () => {
    const year = TERMS.find((t) => t.months === 12)!
    expect(year.discount).toBe(20)
    // 59 × 12 = 708, less 20%
    expect(termPriceIn('pro', year, 'USD')).toBe(566)
  })

  it('never quotes a longer term above the price of a shorter one', () => {
    for (const id of PURCHASABLE_PLANS) {
      const rates = TERMS.map((term) => termMonthlyIn(id, term, 'USD'))
      expect(rates).toEqual([...rates].sort((a, b) => b - a))
    }
  })

  it('reports an effective monthly rate below the list price on a discount', () => {
    const year = TERMS.find((t) => t.months === 12)!
    expect(termMonthlyIn('starter', year, 'USD')).toBeLessThan(monthlyPrice('starter', 'USD'))
  })
})

describe('formatting', () => {
  it('puts the dollar sign on the front', () => {
    expect(formatPrice(29, 'USD')).toBe('$29')
  })

  it('separates thousands', () => {
    expect(formatPrice(12_345, 'USD')).toBe('$12,345')
  })

  it('adds the code for payment requests', () => {
    expect(priceWithCode(566, 'USD')).toBe('$566 USD')
  })
})
