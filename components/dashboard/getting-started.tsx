'use client'

import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useUserContext } from '@/contexts/user-context'
import { useWorkspaceRole } from '@/hooks/use-workspace-role'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight, Check, Circle } from 'lucide-react'

/**
 * First-run checklist.
 *
 * A new account lands on a dashboard of zeroes with no indication of what to do
 * first. Every page has its own empty state, but nothing said which page to
 * start on — and the order matters here: an entry tagged with a client that
 * does not exist is invisible on that client's dashboard, so the client has to
 * come first.
 *
 * Disappears for good once the last step is done. A checklist that lingers
 * after completion becomes furniture.
 */
export function GettingStarted() {
  const { profile } = useUserContext()
  const { can } = useWorkspaceRole()

  const clients = useQuery(api.clients.getClients, profile?._id ? {} : 'skip')
  const content = useQuery(api.content.getAllContent, profile?._id ? {} : 'skip')

  // Wait for both before deciding — rendering the checklist and pulling it away
  // a moment later is worse than a short blank.
  if (!clients || !content) return null

  const hasClient = clients.length > 0
  const hasSlug = clients.some((client) => !!client.slug)
  const hasEntry = content.length > 0
  const hasHandle = !!profile?.handle

  const steps = [
    {
      done: hasClient,
      title: 'Add your first client',
      description:
        'Everything is organised by client — content, dashboards and earnings all hang off this.',
      href: '/dashboard/clients',
      cta: 'Add a client',
    },
    {
      done: hasSlug,
      title: 'Give them a dashboard slug',
      description:
        'The slug becomes their live URL. Entries are matched to a client by it, so content tagged with a client that has no slug will not appear anywhere.',
      href: '/dashboard/clients',
      cta: 'Set a slug',
    },
    {
      done: hasEntry,
      title: 'Log a piece of content',
      description:
        'A blog post, video, talk, package or demo. The form adapts to the category and takes about 30 seconds.',
      href: '/dashboard/add',
      cta: 'Add an entry',
    },
    {
      done: hasHandle,
      title: 'Claim your public handle',
      description:
        'Optional. Publishes everything marked Published at devrel.studio/@you — a portfolio you can share.',
      href: '/dashboard/settings',
      cta: 'Claim a handle',
    },
  ]

  const completed = steps.filter((step) => step.done).length
  if (completed === steps.length) return null

  // A viewer cannot complete any of these; telling them to would be noise.
  if (!can.create) return null

  const next = steps.find((step) => !step.done)!

  return (
    <Card className="mb-8 border-accent/25 bg-accent/[0.03]">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-medium text-foreground">Getting started</h2>
          <p className="font-mono text-xs text-muted-foreground">
            {completed} of {steps.length}
          </p>
        </div>

        <ol className="mt-5 space-y-3">
          {steps.map((step) => {
            const isNext = step === next
            return (
              <li key={step.title} className="flex items-start gap-3">
                {step.done ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                ) : (
                  <Circle
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      isNext ? 'text-foreground' : 'text-muted-foreground/40'
                    }`}
                  />
                )}

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm ${
                      step.done
                        ? 'text-muted-foreground line-through decoration-muted-foreground/40'
                        : isNext
                          ? 'font-medium text-foreground'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {step.title}
                  </p>

                  {/* Only the next step explains itself. Four descriptions at
                      once is a wall of text on a screen that is meant to
                      reduce hesitation. */}
                  {isNext && (
                    <>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {step.description}
                      </p>
                      <Link
                        href={step.href}
                        className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90"
                      >
                        {step.cta}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
