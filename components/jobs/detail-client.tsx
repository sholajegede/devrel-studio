'use client'

import { Check, Globe2, X } from 'lucide-react'
import { COUNTRY_OPTIONS, countryName, eligibility, type RemoteScope, type Workplace } from '@/lib/jobs/locations'
import { useCountry } from '@/components/jobs/use-country'

export function EligibilityPanel({
  job,
}: {
  job: { workplace: string; remoteScope: string | null; countries: string[]; regions: string[] }
}) {
  const [country, setCountry] = useCountry()

  const fit = country
    ? eligibility(
        {
          workplace: job.workplace as Workplace,
          remoteScope: job.remoteScope as RemoteScope | null,
          countries: job.countries,
          regions: job.regions,
        },
        country,
      )
    : null

  return (
    <div className="rounded-lg border border-border p-3 text-sm">
      <div className="flex items-center gap-2 font-medium text-foreground">
        <Globe2 className="h-4 w-4 text-muted-foreground" />
        Can you apply from where you live?
      </div>
      <select
        value={country ?? ''}
        onChange={(event) => setCountry(event.target.value || undefined)}
        className="mt-2 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        aria-label="Your country"
      >
        <option value="">Choose your country</option>
        {COUNTRY_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {option.name}
          </option>
        ))}
      </select>
      {country && fit === 'yes' && (
        <p className="mt-2 flex items-start gap-1.5 text-emerald-700 dark:text-emerald-400">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          Open to candidates in {countryName(country)}.
        </p>
      )}
      {country && fit === 'local' && (
        <p className="mt-2 flex items-start gap-1.5 text-emerald-700 dark:text-emerald-400">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          Based in {countryName(country)}.
        </p>
      )}
      {country && fit === 'no' && (
        <p className="mt-2 flex items-start gap-1.5 text-muted-foreground">
          <X className="mt-0.5 h-4 w-4 shrink-0" />
          This role does not list {countryName(country)}. Check the posting before you apply.
        </p>
      )}
      {country && fit === 'unknown' && (
        <p className="mt-2 text-muted-foreground">
          The posting does not say where candidates can be based. Ask the employer.
        </p>
      )}
    </div>
  )
}
