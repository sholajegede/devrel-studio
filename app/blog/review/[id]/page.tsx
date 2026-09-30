'use client'

import { use, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { ReviewEditor, type Changes } from '@/components/blog/review-editor'

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const token = useSearchParams().get('t') ?? ''
  const post = useQuery(api.blog.forReview, { id: id as Id<'blogPosts'>, token })
  const review = useMutation(api.blog.review)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<'published' | 'rejected' | null>(null)

  const decide = async (decision: 'publish' | 'reject' | 'save', changes: Changes) => {
    setBusy(true)
    try {
      const result = await review({ id: id as Id<'blogPosts'>, token, decision, ...changes })
      if (result.status === 'published') setDone('published')
      else if (result.status === 'rejected') setDone('rejected')
      else toast.success('Edits saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <p className="mb-6 text-sm text-muted-foreground">devrel.studio · blog review</p>
      {post === undefined ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : post === null ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="font-medium text-foreground">This link is not valid any more</p>
          <p className="mt-1 text-sm text-muted-foreground">It may have been used already. Open the admin console to decide on this post, or send yourself a new link.</p>
        </div>
      ) : done ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-lg font-semibold text-foreground">{done === 'published' ? 'Published' : 'Rejected'}</p>
          {done === 'published' ? (
            <p className="mt-2 text-sm text-muted-foreground">
              The page goes live within a few seconds. <Link href={`/blog/${post.slug}`} className="text-accent underline">Open the post</Link>
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">The draft was kept but will not be published.</p>
          )}
        </div>
      ) : (
        <ReviewEditor post={post} busy={busy} onDecide={decide} />
      )}
    </main>
  )
}
