'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card } from '@/components/ui/card'
import { EVENTS, type EventName } from '@/lib/jobs/analytics'
import { timeAgo } from '@/lib/jobs/ui'
import { cn } from '@/lib/utils'

// Everything people do on the job board, from visit to offer.

const RANGES = [
  { weeks: 1, label: 'This week' },
  { weeks: 4, label: '4 weeks' },
  { weeks: 8, label: '8 weeks' },
  { weeks: 13, label: '13 weeks' },
]

const number = (value: number) => value.toLocaleString('en-US')
const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '–')
const minutes = (seconds: number) => (seconds >= 120 ? `${Math.round(seconds / 60)} min` : `${Math.round(seconds)} s`)

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </Card>
  )
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      <div className="mt-3">{children}</div>
    </Card>
  )
}

function Bars({ rows, empty = 'Nothing yet.' }: { rows: { name: string; count: number }[]; empty?: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  const max = Math.max(...rows.map((row) => row.count), 1)
  return (
    <ul className="space-y-1.5">
      {rows.map((row) => (
        <li key={row.name} className="text-sm">
          <div className="flex justify-between gap-3">
            <span className="min-w-0 truncate text-foreground">{row.name}</span>
            <span className="tabular-nums text-muted-foreground">{number(row.count)}</span>
          </div>
          <div className="mt-0.5 h-1 rounded-full bg-muted">
            <div className="h-1 rounded-full bg-accent" style={{ width: `${Math.max((row.count / max) * 100, 2)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function Trend({ days, series }: { days: { day: string; values: Record<string, number> }[]; series: { key: string; label: string; className: string }[] }) {
  const max = Math.max(1, ...days.flatMap((day) => series.map((s) => day.values[s.key] ?? 0)))
  return (
    <div>
      <div className="flex h-36 items-end gap-px" role="img" aria-label="Daily activity">
        {days.map((day) => (
          <div key={day.day} className="group relative flex h-full min-w-0 flex-1 items-end gap-px" title={`${day.day}: ${series.map((s) => `${s.label} ${day.values[s.key] ?? 0}`).join(', ')}`}>
            {series.map((s) => (
              <div key={s.key} className={cn('min-w-px flex-1 rounded-t-sm', s.className)} style={{ height: `${((day.values[s.key] ?? 0) / max) * 100}%` }} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-sm', s.className)} />
            {s.label}
          </span>
        ))}
        <span className="ml-auto">{days[0]?.day} to {days[days.length - 1]?.day}</span>
      </div>
    </div>
  )
}

export default function JobAnalyticsPage() {
  const [weeks, setWeeks] = useState(4)
  const data = useQuery(api.jobAnalytics.report, { weeks })
  const live = useQuery(api.jobAnalytics.live, { limit: 60 })

  if (data === undefined) return <div className="h-40 animate-pulse rounded-xl bg-muted" />

  const t = (event: string) => data.totals[event] ?? 0
  const visitors = data.weeklyVisitors.reduce((sum, week) => sum + week.count, 0)
  const applies = Math.max(t('apply_click'), t('apply_redirect'))
  const roleViews = Math.max(t('job_view'), 0)
  const opened = t('job_open') + roleViews
  const cvs = t('cv_parsed') + t('cv_text_saved')
  const tourRuns = t('tour_start') + t('tour_replay')
  const leaves = t('page_leave')

  const stepRows = (data.labels.tour_step ?? []).slice().sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/jobs" className="text-xs text-muted-foreground hover:text-foreground">Jobs</Link>
          <h1 className="text-2xl font-semibold text-foreground">Job board analytics</h1>
          <p className="text-sm text-muted-foreground">
            Every visit, search, click, copy, CV, tailored kit and tour. Weeks run Monday to Sunday, UTC. {live ? `${live.online} on the site now.` : ''}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1" role="group" aria-label="Range">
          {RANGES.map((range) => (
            <button
              key={range.weeks}
              type="button"
              onClick={() => setWeeks(range.weeks)}
              className={cn('rounded-md px-3 py-1 text-sm transition-colors', weeks === range.weeks ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {data.truncated && (
        <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          This range has more rows than one report reads. Pick a shorter range for exact lists.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Kpi label="Visitors" value={number(visitors)} note="Counted once per week, then added" />
        <Kpi label="New visitors" value={number(t('new_visitor'))} note={`${percent(t('new_visitor'), visitors)} of visitors`} />
        <Kpi label="Sessions" value={number(t('session'))} />
        <Kpi label="Page views" value={number(t('page_view'))} />
        <Kpi label="Time on page" value={leaves ? minutes(t('seconds_on_page') / leaves) : '–'} note="Average per page" />
        <Kpi label="Role pages viewed" value={number(roleViews)} />
        <Kpi label="Searches" value={number(t('search'))} note={`${number(t('no_results'))} found nothing`} />
        <Kpi label="Apply clicks" value={number(applies)} note={`${percent(applies, roleViews)} of role views`} />
        <Kpi label="Saved to tracker" value={number(t('save'))} note={`${number(t('save_signin_click'))} tried while signed out`} />
        <Kpi label="Sign-up clicks" value={number(t('cta_click'))} />
        <Kpi label="CVs added" value={number(cvs)} note={`${number(t('cv_failed'))} unreadable`} />
        <Kpi label="Tailored CVs" value={number(t('kit_done'))} note={`${number(t('kit_requested'))} asked, ${number(t('kit_failed'))} failed`} />
        <Kpi label="Alerts created" value={number(t('alert_created'))} />
        <Kpi label="Jobs Pro requests" value={number(t('pro_requested'))} note={`${number(t('pro_view'))} views of the page`} />
        <Kpi label="Links copied" value={number(t('link_copy'))} note={`${number(t('share_click'))} shares`} />
        <Kpi label="Text copied" value={number(t('text_copy'))} />
        <Kpi label="Tour runs" value={number(tourRuns)} note={`${number(t('tour_done'))} finished, ${number(t('tour_skip'))} skipped`} />
        <Kpi label="Tour finish rate" value={percent(t('tour_done'), t('tour_done') + t('tour_skip'))} />
      </div>

      <Panel title="Day by day">
        <Trend
          days={data.days}
          series={[
            { key: 'visitor', label: 'Visitors', className: 'bg-accent' },
            { key: 'job_view', label: 'Role views', className: 'bg-foreground/50' },
            { key: 'apply_redirect', label: 'Apply clicks', className: 'bg-emerald-500' },
          ]}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="From visit to application" note="Each step counts events, not people.">
          <Bars
            rows={[
              { name: 'Visitors', count: visitors },
              { name: 'Opened a role', count: opened },
              { name: 'Clicked apply', count: applies },
              { name: 'Saved to tracker', count: t('save') },
              { name: 'Asked for a tailored CV', count: t('kit_requested') },
            ]}
          />
        </Panel>
        <Panel title="Top roles" note="Ranked by apply clicks, then views.">
          {data.topJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="pb-1 font-medium">Role</th>
                    <th className="pb-1 text-right font-medium">Views</th>
                    <th className="pb-1 text-right font-medium">Apply</th>
                    <th className="pb-1 text-right font-medium">Kits</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topJobs.map((job) => (
                    <tr key={job.slug} className="border-t border-border">
                      <td className="py-1.5 pr-2">
                        <Link href={`/jobs/${job.slug}`} className="font-medium text-foreground hover:underline">{job.title}</Link>
                        <span className="block text-xs text-muted-foreground">{job.company}</span>
                      </td>
                      <td className="text-right tabular-nums">{job.counts.job_view ?? 0}</td>
                      <td className="text-right tabular-nums">{Math.max(job.counts.apply_click ?? 0, job.counts.apply_redirect ?? 0)}</td>
                      <td className="text-right tabular-nums">{job.counts.kit_requested ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel title="Top companies" note="By apply clicks.">
          <Bars rows={data.topCompanies.map((company) => ({ name: company.name, count: Math.max(company.counts.apply_click ?? 0, company.counts.apply_redirect ?? 0) || (company.counts.company_click ?? 0) }))} />
        </Panel>
        <Panel title="Where visitors come from">
          <Bars rows={data.referrers} empty="No referrers yet." />
        </Panel>
        <Panel title="Pages">
          <Bars rows={data.pages} />
        </Panel>
        <Panel title="Countries" note="From the host's edge. No address is stored.">
          <Bars rows={data.countries} empty="Not available on this host." />
        </Panel>
        <Panel title="Devices and accounts">
          <Bars rows={[...data.devices, ...data.audience]} />
        </Panel>
      </div>

      <h2 className="pt-2 text-lg font-semibold text-foreground">What people search and filter</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Searches"><Bars rows={data.labels.search ?? []} /></Panel>
        <Panel title="Searches that found nothing" note="Roles people want that the board does not have."><Bars rows={data.labels.no_results ?? []} /></Panel>
        <Panel title="Filters turned on"><Bars rows={data.labels.filter_on ?? []} /></Panel>
        <Panel title="Filters turned off"><Bars rows={data.labels.filter_off ?? []} /></Panel>
        <Panel title="Adjacent roles" note="The toggle in the filters.">
          <Bars rows={[{ name: 'Turned on', count: t('adjacent_on') }, { name: 'Turned off', count: t('adjacent_off') }]} />
        </Panel>
        <Panel title="Sort and country">
          <Bars rows={[...(data.labels.sort_change ?? []).map((row) => ({ name: `sort: ${row.name}`, count: row.count })), ...(data.labels.country_set ?? []).map((row) => ({ name: `country: ${row.name}`, count: row.count }))]} />
        </Panel>
        <Panel title="List use">
          <Bars rows={[
            { name: 'Show more roles', count: t('load_more') },
            { name: 'Filters cleared', count: t('clear_filters') },
            { name: 'Filters opened on a phone', count: t('filters_open') },
          ]} />
        </Panel>
      </div>

      <h2 className="pt-2 text-lg font-semibold text-foreground">Sharing and copying</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Links copied" note="The copy link button, and any link someone copies from the page."><Bars rows={data.labels.link_copy ?? []} /></Panel>
        <Panel title="Shares"><Bars rows={data.labels.share_click ?? []} /></Panel>
        <Panel title="Text copied, by page"><Bars rows={data.labels.text_copy ?? []} /></Panel>
        <Panel title="Right click on a link" note="Often a link being copied or opened in a new tab."><Bars rows={data.labels.link_menu ?? []} /></Panel>
        <Panel title="Outbound links"><Bars rows={data.labels.outbound_click ?? []} /></Panel>
        <Panel title="Navigation"><Bars rows={data.labels.nav_click ?? []} /></Panel>
        <Panel title="Sign-up clicks, by page"><Bars rows={data.labels.cta_click ?? []} /></Panel>
      </div>

      <h2 className="pt-2 text-lg font-semibold text-foreground">Tour</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Started by itself"><Bars rows={data.labels.tour_start ?? []} /></Panel>
        <Panel title="Started with the button"><Bars rows={data.labels.tour_replay ?? []} /></Panel>
        <Panel title="Finished"><Bars rows={data.labels.tour_done ?? []} /></Panel>
        <Panel title="Skipped"><Bars rows={data.labels.tour_skip ?? []} /></Panel>
        <Panel title="Where people stop" note="Views of each step. A sharp fall marks a confusing step.">
          <Bars rows={stepRows} empty="No tour steps shown yet." />
        </Panel>
      </div>

      <h2 className="pt-2 text-lg font-semibold text-foreground">CV, kits and tracker</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="CV">
          <Bars rows={[
            { name: 'Uploaded', count: t('cv_upload') },
            { name: 'Read', count: t('cv_parsed') },
            { name: 'Could not be read', count: t('cv_failed') },
            { name: 'Text pasted', count: t('cv_text_saved') },
            { name: 'Removed', count: t('cv_removed') },
            { name: 'Preferences saved', count: t('profile_saved') },
          ]} />
        </Panel>
        <Panel title="Tailored CVs">
          <Bars rows={[
            { name: 'Asked for', count: t('kit_requested') },
            { name: 'Ready', count: t('kit_done') },
            { name: 'Failed', count: t('kit_failed') },
            { name: 'Text copied', count: t('kit_copied') },
          ]} />
        </Panel>
        <Panel title="Why kits failed"><Bars rows={data.labels.kit_failed ?? []} /></Panel>
        <Panel title="Alerts"><Bars rows={[...(data.labels.alert_created ?? []).map((row) => ({ name: `created, ${row.name}`, count: row.count })), { name: 'Removed', count: t('alert_removed') }]} /></Panel>
        <Panel title="Tracker">
          <Bars rows={[
            { name: 'Added by hand', count: t('tracker_add') },
            { name: 'Cards opened', count: t('tracker_open') },
            { name: 'Cards moved', count: t('tracker_move') },
          ]} />
        </Panel>
        <Panel title="Where cards go"><Bars rows={data.labels.tracker_move ?? []} /></Panel>
      </div>

      <Panel title="Every event" note="The full list, with counts for the range above.">
        <div className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          {(Object.keys(EVENTS) as EventName[]).map((event) => (
            <div key={event} className="flex justify-between gap-3 border-b border-border py-1">
              <span className="text-foreground">{EVENTS[event].label}<span className="ml-2 text-xs text-muted-foreground">{EVENTS[event].group}</span></span>
              <span className="tabular-nums text-muted-foreground">{number(t(event))}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Live feed" note="The newest events. Visitors show as the first six characters of a random id.">
        {live === undefined ? (
          <div className="h-24 animate-pulse rounded bg-muted" />
        ) : live.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {live.events.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">{timeAgo(row.ts)}</span>
                <span className="font-medium text-foreground">{row.label}</span>
                {row.detail && <span className="text-muted-foreground">{row.detail}</span>}
                {row.slug && <span className="text-muted-foreground">{row.slug}</span>}
                {row.n !== undefined && <span className="tabular-nums text-muted-foreground">{row.n}</span>}
                <span className="ml-auto text-xs text-muted-foreground">
                  {row.path} · {row.who}{row.device ? ` · ${row.device}` : ''}{row.country ? ` · ${row.country}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
