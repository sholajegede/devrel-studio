'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery } from 'convex/react'
import { Check, Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { RoleNotice } from '@/components/dashboard/role-notice'
import { JobsHeader } from '@/components/jobs/jobs-tabs'
import { Monogram } from '@/components/jobs/job-card'

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {
          toast.error('Could not copy')
        }
      }}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {label}
    </Button>
  )
}

export default function KitPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const data = useQuery(api.jobs.bySlug, { slug })
  const job = data?.job
  const kit = useQuery(api.jobKit.forJob, job ? { jobId: job._id } : 'skip')
  const status = useQuery(api.jobPro.status)
  const request = useMutation(api.jobKit.request)
  const [busy, setBusy] = useState(false)

  const pending = kit?.status === 'pending'
  // A request that never finished should not hold the button hostage.
  const [stale, setStale] = useState(false)
  useEffect(() => {
    if (!pending) return setStale(false)
    const timer = setTimeout(() => setStale(true), 90_000)
    return () => clearTimeout(timer)
  }, [pending, kit?._id])

  const generate = async () => {
    if (!job) return
    setBusy(true)
    try {
      await request({ jobId: job._id })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start')
    } finally {
      setBusy(false)
    }
  }

  const all =
    kit && kit.status === 'ready'
      ? [kit.summary, ...(kit.bullets ?? []).map((bullet) => `- ${bullet}`), '', kit.coverNote].filter((part) => part !== undefined).join('\n')
      : ''

  return (
    <main className="px-6 py-8 lg:px-10 max-w-400">
      <RoleNotice />
      <JobsHeader title="Application kit" description="CV bullets and a cover note for one role, built from your CV and your published work." />

      {data === undefined ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : !job ? (
        <p className="text-sm text-muted-foreground">That role is no longer listed.</p>
      ) : (
        <div className="mx-auto max-w-3xl space-y-5">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <Monogram name={job.companyName} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">{job.title}</p>
              <p className="text-sm text-muted-foreground">{job.companyName}</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/jobs/${job.slug}`}>View role</Link>
            </Button>
          </div>

          {status && !status.pro && (
            <p className="text-sm text-muted-foreground">
              {status.gate.freeLeft > 0
                ? `${status.gate.freeLeft} free tailoring${status.gate.freeLeft === 1 ? '' : 's'} left.`
                : 'You have used your free tailorings.'}{' '}
              <Link href="/dashboard/jobs/pro" className="underline">
                Jobs Pro
              </Link>{' '}
              unlocks more.
            </p>
          )}

          {(!kit || kit.status === 'failed' || stale) && (
            <div className="space-y-3">
              {kit?.status === 'failed' && <p className="text-sm text-destructive">That attempt failed, and it was not counted. Try again.</p>}
              <Button
                onClick={generate}
                disabled={busy || (status ? !status.gate.allowed : false)}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                Tailor my application
              </Button>
              {status && !status.gate.allowed && (
                <p className="text-sm text-muted-foreground">
                  <Link href="/dashboard/jobs/pro" className="underline">
                    Get Jobs Pro
                  </Link>{' '}
                  to keep going.
                </p>
              )}
            </div>
          )}

          {pending && !stale && (
            <div className="flex items-center gap-3 rounded-xl border border-border p-5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading the listing and your work. This takes about 20 seconds.
            </div>
          )}

          {kit?.status === 'ready' && (
            <div className="space-y-5">
              <section className="rounded-xl border border-border bg-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-medium text-foreground">Summary and bullets</h2>
                  <CopyButton text={[kit.summary, ...(kit.bullets ?? []).map((b) => `- ${b}`)].join('\n')} label="Copy" />
                </div>
                <p className="text-sm leading-relaxed text-foreground">{kit.summary}</p>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground">
                  {(kit.bullets ?? []).map((bullet, index) => (
                    <li key={index}>{bullet}</li>
                  ))}
                </ul>
              </section>

              <section className="rounded-xl border border-border bg-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-medium text-foreground">Cover note</h2>
                  <CopyButton text={kit.coverNote ?? ''} label="Copy" />
                </div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{kit.coverNote}</p>
              </section>

              {kit.gaps && kit.gaps.length > 0 && (
                <section className="rounded-xl border border-border p-5">
                  <h2 className="mb-2 font-medium text-foreground">What the role asks for that your CV does not show</h2>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {kit.gaps.map((gap, index) => (
                      <li key={index}>{gap}</li>
                    ))}
                  </ul>
                </section>
              )}

              {kit.flags && kit.flags.length > 0 && (
                <p className="text-xs text-muted-foreground">Worth a read before you send: {kit.flags.join('; ')}.</p>
              )}

              <div className="flex flex-wrap gap-2">
                <CopyButton text={all} label="Copy everything" />
                <Button variant="outline" size="sm" onClick={generate} disabled={busy || (status ? !status.gate.allowed : false)}>
                  Write it again
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Check every line against what you actually did before you send it. Writing it again uses another tailoring.
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
