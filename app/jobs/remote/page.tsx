import type { Metadata } from 'next'
import Link from 'next/link'
import { Crumbs, JobsShell, JsonLd, StaticJobList } from '@/components/jobs/shell'
import { Button } from '@/components/ui/button'
import { breadcrumbLd, itemListLd } from '@/lib/jobs/seo'
import { loadList } from '@/lib/jobs/server'
import { siteOrigin } from '@/lib/site'

export const revalidate = 900

export const metadata: Metadata = {
  title: 'Remote DevRel jobs',
  description: 'Remote developer advocate, DevRel engineer and developer success roles, with the countries each role is open to.',
  alternates: { canonical: `${siteOrigin()}/jobs/remote` },
}

export default async function RemotePage() {
  const origin = siteOrigin()
  const result = await loadList({ workplaces: ['remote'], limit: 60 })
  return (
    <JobsShell>
      <JsonLd
        data={breadcrumbLd(origin, [
          { name: 'Home', path: '/' },
          { name: 'DevRel jobs', path: '/jobs' },
          { name: 'Remote', path: '/jobs/remote' },
        ])}
      />
      {result && <JsonLd data={itemListLd(origin, 'Remote DevRel jobs', result.items)} />}
      <Crumbs trail={[{ name: 'DevRel jobs', href: '/jobs' }, { name: 'Remote' }]} />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Remote DevRel jobs</h1>
      <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
        {result ? `${result.total.toLocaleString('en-US')} remote roles are open.` : 'Remote roles are loading.'} Remote does not
        always mean anywhere: open a role to see whether it is worldwide, limited to a region or limited to one country.
      </p>
      <div className="mt-5">
        <Button asChild variant="outline">
          <Link href="/jobs?w=remote">Filter remote roles by level, pay and country</Link>
        </Button>
      </div>
      <div className="mt-8">{result ? <StaticJobList jobs={result.items} /> : null}</div>
    </JobsShell>
  )
}
