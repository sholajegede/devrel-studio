'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useKindeBrowserClient } from '@kinde-oss/kinde-auth-nextjs'
import {
  currencyForTimeZone,
  formatPrice,
  monthlyPrice,
  DEFAULT_CURRENCY,
  type CurrencyCode,
} from '@/lib/currency'

// Session and currency resolve in the browser so marketing pages stay static.

/** Shows `signedIn` or `signedOut`. Shows `signedOut` until the session is known. */
export function SignedInSwitch({
  signedIn = null,
  signedOut = null,
}: {
  signedIn?: ReactNode
  signedOut?: ReactNode
}) {
  const { isAuthenticated } = useKindeBrowserClient()
  return <>{isAuthenticated === true ? signedIn : signedOut}</>
}

/** The reader's currency, from their time zone. Dollars until mounted. */
export function useLocalCurrency(): CurrencyCode {
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY)
  useEffect(() => {
    setCurrency(currencyForTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone))
  }, [])
  return currency
}

/** The FAQ answer that quotes plan prices, in the reader's currency. */
export function LocalPriceAnswer() {
  const currency = useLocalCurrency()
  const price = (id: 'starter' | 'pro' | 'agency') =>
    formatPrice(monthlyPrice(id, currency), currency)

  return (
    <>
      Starter is {price('starter')} a month, Pro is {price('pro')} and Agency is{' '}
      {price('agency')}. You buy 1, 3, 6 or 12 months at a time, and longer terms cost
      less. The first 14 days are free and need no card.
    </>
  )
}
