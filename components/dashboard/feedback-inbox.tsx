'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { periodLabel } from '@/lib/report'
import { Card, CardContent } from '@/components/ui/card'
import { MessageSquare, Star } from 'lucide-react'

/**
 * What clients said about their reports.
 *
 * The feedback form shipped before this did, which meant a client could reply
 * and the person it was written for would never find out. This is the other
 * half — and it is on the overview rather than behind a tab, because feedback
 * that has to be sought out is feedback that goes unread.
 */
export function FeedbackInbox({ limit = 3 }: { limit?: number }) {
  const feedback = useQuery(api.reports.listFeedback, { limit })

  // Nothing yet is the normal state for a new workspace, and an empty card
  // explaining a feature nobody has used is clutter.
  if (!feedback || feedback.length === 0) return null

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-[15px] font-medium text-foreground">From your clients</h2>
        </div>

        <ul className="mt-5 space-y-4">
          {feedback.map((item) => (
            <li key={item.id} className="border-l-2 border-accent/40 pl-4">
              <p className="text-sm leading-relaxed text-foreground">
                &ldquo;{item.comment}&rdquo;
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {item.authorName ?? item.clientName}
                </span>
                {item.authorName && <span>· {item.clientName}</span>}
                <span>· {periodLabel(item.period)} report</span>

                {item.rating && (
                  <span className="inline-flex items-center gap-0.5 text-accent">
                    · <Star className="h-3 w-3 fill-current" />
                    {item.rating}/5
                  </span>
                )}

                <span>
                  ·{' '}
                  {new Date(item.createdAt).toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
