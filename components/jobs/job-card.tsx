import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { MapPin, Wallet } from 'lucide-react'
import { eligibility, countryName, type Eligibility, type RemoteScope, type Workplace } from '@/lib/jobs/locations'
import { matchLabel } from '@/lib/jobs/match'
import {
  WORKPLACE_LABEL,
  initials,
  monogramHue,
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
  const hue = monogramHue(name)
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-lg text-xs font-semibold"
      style={{
        width: size,
        height: size,
        background: `hsl(${hue} 55% 92%)`,
        color: `hsl(${hue} 45% 28%)`,
      }}
    >
      {initials(name)}
    </div>
  )
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
  return (
    <article className="group relative flex gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20">
      <Monogram name={job.companyName} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold text-foreground">
              <Link href={href} className="after:absolute after:inset-0">
                {job.title}
              </Link>
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{job.companyName}</p>
          </div>
          <div className="relative z-10 flex items-center gap-2">
            {match && <MatchPill score={match.score} />}
            {action}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {job.locationLabel}
          </span>
          <span>{WORKPLACE_LABEL[job.workplace] ?? job.workplace}</span>
          <span>{seniorityLabel(job.seniority)}</span>
          {pay && (
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Wallet className="h-3 w-3" />
              {pay}
            </span>
          )}
          <span>{timeAgo(job.postedAt)}</span>
        </div>

        {(job.skills.length > 0 || country) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <EligibilityChip job={job} country={country} />
            {job.skills.slice(0, 4).map((skill) => (
              <Badge key={skill} variant="secondary" className="font-normal">
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
