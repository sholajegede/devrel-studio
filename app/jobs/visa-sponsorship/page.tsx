import type { Metadata } from 'next'
import Link from 'next/link'
import { Crumbs, Faq, HubLinks, JobsShell, JsonLd, StaticJobList } from '@/components/jobs/shell'
import { Button } from '@/components/ui/button'
import { breadcrumbLd, itemListLd } from '@/lib/jobs/seo'
import { loadList } from '@/lib/jobs/server'
import { siteOrigin } from '@/lib/site'

export const revalidate = 900

export const metadata: Metadata = {
  title: 'DevRel jobs with visa sponsorship',
  description:
    'Developer advocate, DevRel engineer and developer success roles whose postings offer visa sponsorship or relocation support.',
  alternates: { canonical: `${siteOrigin()}/jobs/visa-sponsorship` },
}

const FAQ = [
  {
    q: 'How do you know a role sponsors visas?',
    a: 'We read the posting. A role is marked when the text offers visa sponsorship, a work visa, a Skilled Worker or H-1B route, or an EU Blue Card. A line such as "we are unable to sponsor" marks it as not sponsoring, and that line wins over any offer.',
  },
  {
    q: 'Why do some roles have no label?',
    a: 'Most postings say nothing about visas. We leave those unlabeled instead of guessing. Ask the recruiter before you apply.',
  },
  {
    q: 'Does a sponsoring role mean I get a visa?',
    a: 'No. The employer still has to file, and the visa rules of the country decide the outcome. Treat the label as a lead, and check the posting.',
  },
]

export default async function VisaSponsorshipPage() {
  const origin = siteOrigin()
  const result = await loadList({ visaOnly: true, includeAdjacent: true, limit: 80 })
  return (
    <JobsShell>
      <JsonLd
        data={breadcrumbLd(origin, [
          { name: 'Home', path: '/' },
          { name: 'DevRel jobs', path: '/jobs' },
          { name: 'Visa sponsorship', path: '/jobs/visa-sponsorship' },
        ])}
      />
      {result && <JsonLd data={itemListLd(origin, 'DevRel jobs with visa sponsorship', result.items)} />}
      <Crumbs trail={[{ name: 'DevRel jobs', href: '/jobs' }, { name: 'Visa sponsorship' }]} />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">DevRel jobs with visa sponsorship</h1>
      <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
        {result ? `${result.total.toLocaleString('en-US')} open roles mention visa sponsorship.` : 'Roles are loading.'} Each label comes
        from the text of the posting. Many postings do not mention visas at all, so a missing label does not mean no.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/jobs?visa=1">Filter by level, pay and country</Link>
        </Button>
      </div>
      <div className="mt-4">
        <HubLinks />
      </div>
      <div className="mt-8">{result ? <StaticJobList jobs={result.items} /> : null}</div>
      <Faq items={FAQ} />
    </JobsShell>
  )
}
