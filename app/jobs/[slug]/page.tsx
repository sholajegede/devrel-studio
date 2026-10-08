import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowUpRight, BadgeCheck, Clock3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EligibilityPanel } from '@/components/jobs/detail-client'
import { JobCard, Monogram } from '@/components/jobs/job-card'
import { SaveButton } from '@/components/jobs/save-button'
import { ShareButtons } from '@/components/jobs/share-buttons'
import { Crumbs, JobsShell, JsonLd } from '@/components/jobs/shell'
import { textToBlocks } from '@/lib/jobs/html'
import { breadcrumbLd, jobMetaDescription, jobPostingLd, jobTitleTag } from '@/lib/jobs/seo'
import { loadJob } from '@/lib/jobs/server'
import {
  WORKPLACE_LABEL,
  compactUsd,
  familyLabel,
  payLabel,
  seniorityLabel,
  timeAgo,
} from '@/lib/jobs/ui'
import { siteOrigin } from '@/lib/site'

export const revalidate = 1800
export const dynamicParams = true

export function generateStaticParams() {
  return []
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const data = await loadJob(slug)
  if (!data) return { title: 'Role not found | DevRel Studio', robots: { index: false } }

  const job = data.job
  return {
    title: jobTitleTag(job),
    description: jobMetaDescription(job),
    alternates: { canonical: `${siteOrigin()}/jobs/${job.slug}` },
    robots: job.status === 'expired' ? { index: false, follow: true } : undefined,
    openGraph: { title: jobTitleTag(job), description: jobMetaDescription(job), type: 'article' },
  }
}

export default async function JobPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await loadJob(slug)
  if (!data) notFound()

  const { job, description, benchmark, alsoOpenIn, moreAtCompany, similar } = data
  const origin = siteOrigin()
  const expired = job.status === 'expired'
  const pay = payLabel(job)
  const blocks = textToBlocks(description)

  const benchmarkLine =
    benchmark && job.salaryMinUsd != null && job.salaryMaxUsd != null
      ? (() => {
          const mid = (job.salaryMinUsd + job.salaryMaxUsd) / 2
          const direction = mid >= benchmark.median ? 'above' : 'below'
          return `Market median for ${benchmark.exact ? `${seniorityLabel(job.seniority).toLowerCase()} ` : ''}${familyLabel(job.family).toLowerCase()} is ${compactUsd(benchmark.median)} (${benchmark.n} roles with pay). This role sits ${direction} it.`
        })()
      : benchmark
        ? `Roles like this list ${compactUsd(benchmark.p25)} to ${compactUsd(benchmark.p75)} (median ${compactUsd(benchmark.median)}, ${benchmark.n} roles with pay). This posting does not list pay.`
        : null

  return (
    <JobsShell>
      <JsonLd data={jobPostingLd(job, description, origin, data.expiredAt)} />
      <JsonLd
        data={breadcrumbLd(origin, [
          { name: 'Home', path: '/' },
          { name: 'DevRel jobs', path: '/jobs' },
          { name: job.companyName, path: `/jobs/companies/${job.companySlug}` },
          { name: job.title, path: `/jobs/${job.slug}` },
        ])}
      />

      <Crumbs
        trail={[
          { name: 'DevRel jobs', href: '/jobs' },
          { name: job.companyName, href: `/jobs/companies/${job.companySlug}` },
          { name: job.title },
        ]}
      />

      {expired && (
        <div className="mb-6 rounded-xl border border-border bg-secondary p-4 text-sm text-secondary-foreground">
          This role is no longer listed on {job.companyName}’s careers page. Similar open roles are below.
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <article>
          <div className="flex items-start gap-4">
            <Monogram name={job.companyName} size={52} />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-3xl">{job.title}</h1>
              <p className="mt-1 text-muted-foreground">
                <Link href={`/jobs/companies/${job.companySlug}`} className="font-medium text-foreground hover:underline">
                  {job.companyName}
                </Link>{' '}
                · {job.locationLabel}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Badge variant="secondary">{WORKPLACE_LABEL[job.workplace] ?? job.workplace}</Badge>
            <Badge variant="secondary">{seniorityLabel(job.seniority)}</Badge>
            <Badge variant="secondary">{familyLabel(job.family)}</Badge>
            {pay && <Badge variant="outline">{pay} a year</Badge>}
            {job.visa === 'yes' && <Badge variant="outline">Visa sponsorship</Badge>}
            {job.visa === 'no' && <Badge variant="outline" className="text-muted-foreground">No visa sponsorship</Badge>}
          </div>

          <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-foreground">
            {blocks.map((block, index) =>
              block.kind === 'heading' ? (
                <h2 key={index} className="pt-3 text-lg font-semibold">
                  {block.text}
                </h2>
              ) : block.kind === 'list' ? (
                <ul key={index} className="list-disc space-y-1.5 pl-5">
                  {block.items?.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p key={index}>{block.text}</p>
              ),
            )}
            {blocks.length === 0 && (
              <p className="text-muted-foreground">
                The full description is on the employer’s careers page.
              </p>
            )}
          </div>

          {job.skills.length > 0 && (
            <section className="mt-10">
              <h2 className="text-sm font-medium text-muted-foreground">Skills mentioned</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {job.skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="font-normal">
                    {skill}
                  </Badge>
                ))}
              </div>
            </section>
          )}
        </article>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-3 rounded-xl border border-border bg-card p-5">
            {expired ? (
              <Button asChild className="w-full">
                <Link href="/jobs">See open roles</Link>
              </Button>
            ) : (
              <Button asChild className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                <a href={`/jobs/out/${job.slug}`} rel="nofollow noopener" target="_blank">
                  Apply on {job.companyName}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </Button>
            )}
            <SaveButton jobId={job._id} label />
            <ShareButtons slug={job.slug} title={job.title} company={job.companyName} />

            <dl className="space-y-2 pt-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Posted</dt>
                <dd>{timeAgo(job.postedAt)}</dd>
              </div>
              {pay && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Pay</dt>
                  <dd className="font-medium">{pay}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Level</dt>
                <dd>{seniorityLabel(job.seniority)}</dd>
              </div>
            </dl>

            <p className="flex items-start gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
              <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              {expired
                ? 'Closed on the employer’s careers page.'
                : `Checked against ${job.companyName}’s careers feed ${timeAgo(job.lastVerifiedAt).toLowerCase()}.`}
            </p>
          </div>

          {!expired && (
            <EligibilityPanel
              job={{
                workplace: job.workplace,
                remoteScope: job.remoteScope,
                countries: job.countries,
                regions: job.regions,
              }}
            />
          )}

          {benchmarkLine && (
            <div className="rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
              <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                Pay in context
              </p>
              {benchmarkLine}
            </div>
          )}

          {alsoOpenIn.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <p className="mb-2 font-medium text-foreground">Also open in</p>
              <ul className="space-y-1">
                {alsoOpenIn.map((other) => (
                  <li key={other.slug}>
                    <Link href={`/jobs/${other.slug}`} className="text-muted-foreground hover:text-foreground hover:underline">
                      {other.locationLabel}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Apply with proof of work</p>
            <p className="mt-1 leading-relaxed">
              Put your content, talks and metrics on a public portfolio at devrel.studio/@you and link it in your application.
            </p>
            <Link href="/sign-up" className="mt-2 inline-block font-medium text-accent hover:underline">
              Build your portfolio
            </Link>
          </div>
        </aside>
      </div>

      {moreAtCompany.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-4 text-lg font-semibold text-foreground">More at {job.companyName}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {moreAtCompany.map((other) => (
              <JobCard key={other._id} job={other} href={`/jobs/${other.slug}`} />
            ))}
          </div>
        </section>
      )}

      {similar.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Similar roles</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {similar.map((other) => (
              <JobCard key={other._id} job={other} href={`/jobs/${other.slug}`} />
            ))}
          </div>
        </section>
      )}
    </JobsShell>
  )
}
