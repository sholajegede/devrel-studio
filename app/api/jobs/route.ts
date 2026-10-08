import { NextRequest, NextResponse } from 'next/server'
import { loadList, loadStats } from '@/lib/jobs/server'
import { siteOrigin } from '@/lib/site'

export const runtime = 'nodejs'

const list = (value: string | null) => (value ? value.split(',').map((item) => item.trim()).filter(Boolean) : undefined)

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const limit = Math.min(Math.max(Number(params.get('limit') ?? 50) || 50, 1), 200)
  const origin = siteOrigin()

  const [result, stats] = await Promise.all([
    loadList({
      q: params.get('q') ?? undefined,
      families: list(params.get('family')),
      seniority: list(params.get('level')),
      workplaces: list(params.get('workplace')),
      regions: list(params.get('region')),
      country: params.get('country')?.toUpperCase() || undefined,
      company: params.get('company') ?? undefined,
      minSalaryUsd: Number(params.get('min_salary')) || undefined,
      salaryOnly: params.get('salary') === '1' || undefined,
      visaOnly: params.get('visa') === '1' || undefined,
      includeAdjacent: params.get('adjacent') === '1' || undefined,
      postedWithinDays: Number(params.get('days')) || undefined,
      limit,
    }),
    params.get('stats') === '1' ? loadStats() : Promise.resolve(null),
  ])

  if (!result) {
    return NextResponse.json({ error: 'Jobs are unavailable right now' }, { status: 503 })
  }

  return NextResponse.json(
    {
      source: `${origin}/jobs`,
      total: result.total,
      count: result.items.length,
      jobs: result.items.map((job) => ({
        id: job.slug,
        url: `${origin}/jobs/${job.slug}`,
        title: job.title,
        company: job.companyName,
        type: job.family,
        level: job.seniority,
        workplace: job.workplace,
        visaSponsorship: job.visa === 'yes' ? true : job.visa === 'no' ? false : null,
        location: job.locationLabel,
        countries: job.countries,
        regions: job.regions,
        salary:
          job.salaryMin !== null && job.salaryCurrency
            ? { min: job.salaryMin, max: job.salaryMax, currency: job.salaryCurrency, period: 'year' }
            : null,
        skills: job.skills,
        postedAt: new Date(job.postedAt).toISOString(),
        verifiedAt: new Date(job.lastVerifiedAt).toISOString(),
      })),
      ...(stats ? { stats } : {}),
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
        'Access-Control-Allow-Origin': '*',
      },
    },
  )
}
