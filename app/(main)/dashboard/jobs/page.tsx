'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useQuery } from 'convex/react'
import { FileText } from 'lucide-react'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { JobBoard } from '@/components/jobs/job-board'
import { JobsHeader } from '@/components/jobs/jobs-tabs'
import { RoleNotice } from '@/components/dashboard/role-notice'

export default function DiscoverPage() {
  const profile = useQuery(api.jobBoard.myProfile)
  const stats = useQuery(api.jobs.stats)

  const ready = profile && profile.exists
  const matchProfile = ready
    ? {
        skills: profile.skills,
        families: profile.families,
        seniority: profile.seniority,
        workplaces: profile.workplaces,
        country: profile.country,
        minSalaryUsd: profile.minSalaryUsd,
      }
    : null

  return (
    <main className="px-6 py-8 lg:px-10 max-w-400">
      <RoleNotice />
      <JobsHeader
        title="Jobs"
        description="DevRel roles from employers’ own careers pages, refreshed three times a day and ranked against your CV."
      />

      {profile && (!profile.exists || profile.skills.length === 0) && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-card p-4">
          <div>
            <p className="font-medium text-foreground">Rank every role against your CV</p>
            <p className="text-sm text-muted-foreground">
              Upload your CV and set where you live. Each role then shows how well it fits and whether it is open to you.
            </p>
          </div>
          <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link href="/dashboard/jobs/profile">
              <FileText className="h-4 w-4" />
              Add your CV
            </Link>
          </Button>
        </div>
      )}

      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading roles</p>}>
        <JobBoard mode="dashboard" stats={stats ?? null} profile={matchProfile} />
      </Suspense>
    </main>
  )
}
