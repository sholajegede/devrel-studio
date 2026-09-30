'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ReviewEditor, type Changes } from '@/components/blog/review-editor'
import { timeAgo } from '@/lib/jobs/ui'
import { cn } from '@/lib/utils'

const STATUS_STYLE: Record<string, string> = {
  published: 'text-emerald-600 dark:text-emerald-400',
  pending: 'text-amber-600 dark:text-amber-400',
  failed: 'text-red-600 dark:text-red-400',
  rejected: 'text-muted-foreground',
}

function Open({ id }: { id: Id<'blogPosts'> }) {
  const post = useQuery(api.blog.adminGet, { id })
  const decide = useMutation(api.blog.adminDecide)
  const [busy, setBusy] = useState(false)
  if (!post) return <div className="h-24 animate-pulse rounded-xl bg-muted" />
  return (
    <ReviewEditor
      post={post}
      busy={busy}
      onDecide={async (decision, changes: Changes) => {
        setBusy(true)
        try {
          await decide({ id, decision, ...changes })
          toast.success(decision === 'publish' ? 'Published' : decision === 'reject' ? 'Rejected' : 'Saved')
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Failed')
        } finally {
          setBusy(false)
        }
      }}
    />
  )
}

export default function AdminBlogPage() {
  const posts = useQuery(api.blog.adminList)
  const draftNow = useMutation(api.blog.draftNow)
  const resend = useMutation(api.blog.resendReview)
  const decide = useMutation(api.blog.adminDecide)
  const [openId, setOpenId] = useState<Id<'blogPosts'> | null>(null)

  const run = async (label: string, action: () => Promise<unknown>) => {
    try {
      await action()
      toast.success(label)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed')
    }
  }

  if (posts === undefined) return <div className="h-40 animate-pulse rounded-xl bg-muted" />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Blog</h1>
          <p className="text-sm text-muted-foreground">
            A draft is written on Monday, Wednesday and Friday, fact-checked, and emailed for review. Nothing is public until you publish it.{' '}
            <Link href="/blog" className="underline underline-offset-2">Open the blog</Link>
          </p>
        </div>
        <Button variant="outline" onClick={() => run('Drafting started. The review email arrives in a few minutes.', () => draftNow({}))}>
          Draft a post now
        </Button>
      </div>

      {posts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No posts yet.</p>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{post.title}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className={cn('font-medium', STATUS_STYLE[post.status])}>{post.status}</span> · {timeAgo(post.createdAt)}
                    {post.words ? ` · ${post.words} words` : ''}
                    {post.verified + post.flagged > 0 ? ` · ${post.verified}/${post.verified + post.flagged} claims verified` : ''}
                    {post.problems ? ` · ${post.problems} style checks failing` : ''}
                  </p>
                  {post.error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{post.error}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {post.status === 'published' && (
                    <>
                      <Button asChild variant="outline" size="sm"><Link href={`/blog/${post.slug}`}>View</Link></Button>
                      <Button variant="ghost" size="sm" onClick={() => run('Unpublished', () => decide({ id: post.id, decision: 'unpublish' }))}>Unpublish</Button>
                    </>
                  )}
                  {post.status === 'pending' && (
                    <Button variant="outline" size="sm" onClick={() => run('Review email sent', () => resend({ id: post.id }))}>Email me the link again</Button>
                  )}
                  {post.status !== 'drafting' && post.status !== 'checking' && post.status !== 'failed' && (
                    <Button variant="outline" size="sm" onClick={() => setOpenId(openId === post.id ? null : post.id)}>
                      {openId === post.id ? 'Close' : post.status === 'pending' ? 'Review' : 'Open'}
                    </Button>
                  )}
                </div>
              </div>
              {openId === post.id && <div className="mt-4 border-t border-border pt-4"><Open id={post.id} /></div>}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
