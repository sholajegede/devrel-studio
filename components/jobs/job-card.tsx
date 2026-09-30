import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { MapPin, Wallet } from 'lucide-react'
import { CompanyLogo } from '@/components/jobs/company-logo'
import { eligibility, countryName, type Eligibility, type RemoteScope, type Workplace } from '@/lib/jobs/locations'
import { matchLabel } from '@/lib/jobs/match'
import {
  WORKPLACE_LABEL,
  payLabel,
  seniorityLabel,
  timeAgo,
} from '@/lib/jobs/ui'

export interface CardJob {
  _id: string
  slug: string
  title: string
  role: string
  family: string
  seniority: string
  workplace: string
  remoteScope: string | null
  locationLabel: string
  countries: string[]
  regions: string[]
  companyName: string
  companySlug: string
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  skills: string[]
  summary: string
  postedAt: number
  status: string
}

export function Monogram({ name, size = 40 }: { name: string; size?: number }) {
  return <CompanyLogo name={name} size={size} />
}

export function EligibilityChip({ job, country }: { job: CardJob; country?: string }) {
  if (!country) return null
  const fit: Eligibility = eligibility(
    {
      workplace: job.workplace as Workplace,
      remoteScope: job.remoteScope as RemoteScope | null,
      countries: job.countries,
      regions: job.regions,
    },
    country,
  )
  const name = countryName(country)
  if (fit === 'yes') {
    return <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">Open in {name}</Badge>
  }
  if (fit === 'local') {
    return <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">In {name}</Badge>
  }
  if (fit === 'no') {
    return <Badge variant="outline" className="text-muted-foreground">Not open in {name}</Badge>
  }
  return null
}

export function MatchPill({ score }: { score: number }) {
  const tone =
    score >= 80
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
      : score >= 60
        ? 'bg-accent/15 text-accent'
        : 'bg-muted text-muted-foreground'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {score}% · {matchLabel(score)}
    </span>
  )
}

export function JobCard({
  job,
  href,
  country,
  match,
  action,
}: {
  job: CardJob
  href: string
  country?: string
  match?: { score: number; reasons: string[] }
  action?: React.ReactNode
}) {
  const pay = payLabel(job)
  const fresh = Date.now() - job.postedAt < 3 * 24 * 60 * 60 * 1000
  return (
    <article className="group relative flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg hover:shadow-black/5">
      <Monogram name={job.companyName} size={48} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              {job.companyName}
              {fresh && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
                  New
                </span>
              )}
            </p>
            <h3 className="mt-0.5 text-base font-semibold leading-snug text-foreground">
              <Link href={href} className="after:absolute after:inset-0 group-hover:text-accent">
                {job.title}
              </Link>
            </h3>
          </div>
          <div className="relative z-10 flex items-center gap-2">
            {match && <MatchPill score={match.score} />}
            {action}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {pay && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-700 dark:text-emerald-400">
              <Wallet className="h-3 w-3" />
              {pay}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {job.locationLabel}
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
            {WORKPLACE_LABEL[job.workplace] ?? job.workplace}
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
            {seniorityLabel(job.seniority)}
          </span>
          <span className="ml-auto text-muted-foreground">{timeAgo(job.postedAt)}</span>
        </div>

        {(job.skills.length > 0 || country) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <EligibilityChip job={job} country={country} />
            {job.skills.slice(0, 4).map((skill) => (
              <Badge key={skill} variant="outline" className="font-normal text-muted-foreground">
                {skill}
              </Badge>
            ))}
          </div>
        )}

        {match && match.reasons.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">{match.reasons[0]}</p>
        )}
      </div>
    </article>
  )
}
