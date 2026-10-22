import Link from 'next/link'
import { MarketingNav } from '@/components/marketing/nav'
import { MarketingFooter } from '@/components/marketing/footer'
import { serialiseLd } from '@/lib/jobs/seo'
import type { CardJob } from '@/components/jobs/job-card'
import { Monogram } from '@/components/jobs/job-card'
import { payLabel, timeAgo } from '@/lib/jobs/ui'
import { JobsAnalytics } from '@/components/jobs/jobs-analytics'

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiseLd(data) }} />
}

export function JobsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <JobsAnalytics />
      <MarketingNav />
      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-8 sm:py-10">{children}</main>
      <MarketingFooter />
    </div>
  )
}

export function Crumbs({ trail }: { trail: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        {trail.map((item, index) => (
          <li key={item.name} className="flex items-center gap-1.5">
            {index > 0 && <span aria-hidden>/</span>}
            {item.href ? (
              <Link href={item.href} className="hover:text-foreground">
                {item.name}
              </Link>
            ) : (
              <span className="text-foreground">{item.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function StaticJobList({ jobs }: { jobs: CardJob[] }) {
  return (
    <ul className="space-y-3">
      {jobs.map((job) => {
        const pay = payLabel(job)
        return (
          <li key={job._id} className="flex gap-4 rounded-[1.5rem] bg-sand p-5">
            <Monogram name={job.companyName} />
            <div className="min-w-0">
              <Link href={`/jobs/${job.slug}`} className="text-[15px] font-semibold text-foreground hover:underline">
                {job.title}
              </Link>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {job.companyName} · {job.locationLabel}
                {pay ? ` · ${pay}` : ''} · {timeAgo(job.postedAt)}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function HubLinks() {
  const links = [
    { href: '/jobs', label: 'All roles' },
    { href: '/jobs/salaries', label: 'Salaries' },
    { href: '/jobs/companies', label: 'Companies hiring' },
    { href: '/jobs/remote', label: 'Remote roles' },
    { href: '/jobs/visa-sponsorship', label: 'Visa sponsorship' },
    { href: '/jobs/contract', label: 'Contract and freelance' },
  ]
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-full bg-card px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
        >
          {link.label}
        </Link>
      ))}
    </div>
  )
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <section aria-labelledby="faq" className="mx-auto mt-24 max-w-3xl">
      <h2 id="faq" className="text-center text-[clamp(2rem,4.5vw,3.25rem)] font-medium leading-[1.05] tracking-[-0.035em] text-foreground">
        Questions, answered
      </h2>
      <dl className="mt-10 space-y-3">
        {items.map((item) => (
          <div key={item.q} className="rounded-[1.5rem] bg-sand p-7">
            <dt className="text-lg font-medium tracking-[-0.02em] text-foreground">{item.q}</dt>
            <dd className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{item.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
