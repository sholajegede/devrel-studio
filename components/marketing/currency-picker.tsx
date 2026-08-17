import Link from 'next/link'
import { CURRENCIES, type CurrencyCode } from '@/lib/currency'

/**
 * Lets a reader switch the currency the prices are quoted in.
 *
 * Links rather than a dropdown, and no client JavaScript at all: the server
 * already decided a currency from the request, so the first paint is right and
 * this only exists for the reader whose location guessed wrong. A link also
 * survives being copied to someone else, which a piece of local state does not.
 */
export function CurrencyPicker({ current }: { current: CurrencyCode }) {
  const codes = Object.keys(CURRENCIES) as CurrencyCode[]

  return (
    <div className="mt-8 flex items-center justify-center gap-1.5">
      <span className="mr-1 text-xs text-muted-foreground">Show prices in</span>
      {codes.map((code) => {
        const active = code === current
        return (
          <Link
            key={code}
            href={`/pricing?currency=${code}`}
            scroll={false}
            aria-current={active ? 'true' : undefined}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              active
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {CURRENCIES[code].symbol} {code}
          </Link>
        )
      })}
    </div>
  )
}
