'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from 'convex/react'
import { Lock } from 'lucide-react'
import { api } from '@/convex/_generated/api'
import { RoleNotice } from '@/components/dashboard/role-notice'
import { JobsHeader } from '@/components/jobs/jobs-tabs'
import { REGIONS } from '@/lib/jobs/locations'
import { FAMILIES, SENIORITIES } from '@/lib/jobs/taxonomy'
import { compactUsd } from '@/lib/jobs/ui'

const SCOPE_NOTE = {
  exact: 'Roles matching your role, level and region.',
  level: 'Too few salaries for your region, so this covers every region at your level.',
  family: 'Too few salaries at your level, so this covers every level in this role type.',
} as const

function Locked() {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-border p-10 text-center">
      <Lock className="mx-auto mb-3 h-5 w-5 text-muted-foreground" />
      <p className="font-medium text-foreground">Pay benchmarks and the hiring view are part of Jobs Pro</p>
      <p className="mt-1 text-sm text-muted-foreground">
        See what your exact role, level and region pays, and which companies hire again and again.
      </p>
      <Link href="/dashboard/jobs/pro" className="mt-4 inline-block text-sm font-medium text-accent underline">
        See Jobs Pro
      </Link>
    </div>
  )
}

export default function MarketPage() {
  const status = useQuery(api.jobPro.status)
  const pro = status?.pro === true
  const [family, setFamily] = useState('advocacy')
  const [seniority, setSeniority] = useState('')
  const [region, setRegion] = useState('')

  const benchmark = useQuery(
    api.jobPro.benchmark,
    pro ? { family, seniority: seniority || undefined, region: region || undefined } : 'skip',
  )
  const hiring = useQuery(api.jobPro.hiring, pro ? {} : 'skip')

  return (
    <main className="px-6 py-8 lg:px-10 max-w-400">
      <RoleNotice />
      <JobsHeader title="Market" description="What roles pay and who is hiring, from live listings." />

      {status === undefined ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : !pro ? (
        <Locked />
      ) : (
        <div className="space-y-8">
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 font-medium text-foreground">Pay benchmark</h2>
            <div className="flex flex-wrap gap-3">
              <select value={family} onChange={(e) => setFamily(e.target.value)} aria-label="Role type" className="h-9 rounded-md border border-border bg-background px-2 text-sm">
                {FAMILIES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select value={seniority} onChange={(e) => setSeniority(e.target.value)} aria-label="Level" className="h-9 rounded-md border border-border bg-background px-2 text-sm">
                <option value="">Any level</option>
                {SENIORITIES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region" className="h-9 rounded-md border border-border bg-background px-2 text-sm">
                <option value="">Any region</option>
                {REGIONS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {benchmark === undefined ? (
              <div className="mt-5 h-24 animate-pulse rounded-lg bg-muted" />
            ) : benchmark === null ? (
              <p className="mt-5 text-sm text-muted-foreground">Fewer than three listings show pay for this role type, so there is nothing reliable to report yet.</p>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: 'Lower quartile', value: benchmark.p25 },
                    { label: 'Median', value: benchmark.median },
                    { label: 'Upper quartile', value: benchmark.p75 },
                    { label: 'Highest listed', value: benchmark.high },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-border p-4">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-xl font-semibold tabular-nums text-foreground">{compactUsd(item.value)}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {SCOPE_NOTE[benchmark.scope]} Based on {benchmark.n} listings with pay, midpoint of each range, in US dollars a year.
                </p>
                <div>
                  <p className="mb-2 text-sm font-medium">Top of the range</p>
                  <ul className="space-y-1 text-sm">
                    {benchmark.topPaying.map((row) => (
                      <li key={row.slug} className="flex justify-between gap-3">
                        <Link href={`/jobs/${row.slug}`} className="truncate hover:underline">
                          {row.title}, {row.company}
                        </Link>
                        <span className="tabular-nums text-muted-foreground">up to {compactUsd(row.max)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="font-medium text-foreground">Hiring view</h2>
            {hiring === undefined ? (
              <div className="h-40 animate-pulse rounded-xl bg-muted" />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Hiring again and again" note="Open roles per company, repeated titles first">
                  {hiring.repeat.map((row) => (
                    <Row key={row.slug} href={`/jobs/companies/${row.slug}`} left={row.company} right={`${row.open} open`} sub={row.titles.join(', ')} />
                  ))}
                </Panel>
                <Panel title="Open the longest" note="Posted longest ago and still listed">
                  {hiring.longestOpen.map((row) => (
                    <Row key={row.jobSlug} href={`/jobs/${row.jobSlug}`} left={row.title} right={`${row.days} days`} sub={row.company} />
                  ))}
                </Panel>
                <Panel title="Posting fast this week" note="Two or more new roles in seven days">
                  {hiring.surging.map((row) => (
                    <Row key={row.slug} href={`/jobs/companies/${row.slug}`} left={row.company} right={`${row.newThisWeek} new`} sub={`${row.open} open in total`} />
                  ))}
                </Panel>
                <Panel title="Roles that keep closing" note="Two or more closed in the last 30 days">
                  {hiring.churn.map((row) => (
                    <Row key={row.slug} href={`/jobs/companies/${row.slug}`} left={row.company} right={`${row.closedLast30} closed`} />
                  ))}
                </Panel>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  )
}

function Panel({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children]
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mb-3 text-xs text-muted-foreground">{note}</p>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">Nothing yet.</p> : <ul className="space-y-2">{children}</ul>}
    </div>
  )
}

function Row({ href, left, right, sub }: { href: string; left: string; right: string; sub?: string }) {
  return (
    <li className="text-sm">
      <div className="flex justify-between gap-3">
        <Link href={href} className="truncate font-medium text-foreground hover:underline">
          {left}
        </Link>
        <span className="shrink-0 tabular-nums text-muted-foreground">{right}</span>
      </div>
      {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
    </li>
  )
}
