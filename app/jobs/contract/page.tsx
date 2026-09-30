import type { Metadata } from 'next'
import Link from 'next/link'
import { Crumbs, JobsShell, JsonLd, StaticJobList } from '@/components/jobs/shell'
import { Button } from '@/components/ui/button'
import { breadcrumbLd, itemListLd } from '@/lib/jobs/seo'
import { loadList } from '@/lib/jobs/server'
import { siteOrigin } from '@/lib/site'

export const revalidate = 900

export const metadata: Metadata = {
  title: 'Contract and freelance DevRel jobs',
  description: 'Contract, freelance and fixed-term developer advocate, DevRel engineer, technical writing and community roles, from company careers pages, We Work Remotely, RemoteOK and the Hacker News hiring threads.',
  alternates: { canonical: `${siteOrigin()}/jobs/contract` },
}

export default async function ContractPage() {
  const origin = siteOrigin()
  const result = await loadList({ employment: ['contract'], limit: 60 })
  return (
    <JobsShell>
      <JsonLd
        data={breadcrumbLd(origin, [
          { name: 'Home', path: '/' },
          { name: 'DevRel jobs', path: '/jobs' },
          { name: 'Contract', path: '/jobs/contract' },
        ])}
      />
      {result && <JsonLd data={itemListLd(origin, 'Contract and freelance DevRel jobs', result.items)} />}
      <Crumbs trail={[{ name: 'DevRel jobs', href: '/jobs' }, { name: 'Contract' }]} />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Contract and freelance DevRel jobs</h1>
      <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
        {result ? `${result.total.toLocaleString('en-US')} contract and freelance roles are open.` : 'Contract roles are loading.'} These come
        from company careers pages and from the Hacker News hiring and freelancer threads, We Work Remotely and RemoteOK. Check the rate and
        term with the company before you commit.
      </p>
      <div className="mt-5">
        <Button asChild variant="outline">
          <Link href="/jobs?e=contract">Filter contract roles by level, pay and country</Link>
        </Button>
      </div>
      <div className="mt-8">{result ? <StaticJobList jobs={result.items} /> : null}</div>
    </JobsShell>
  )
}
