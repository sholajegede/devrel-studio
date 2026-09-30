'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Prose } from '@/components/blog/prose'
import { parseMarkdown } from '@/lib/blog/markdown'
import { cn } from '@/lib/utils'

export interface ReviewPost {
  id: string
  slug: string
  title: string
  description: string
  keyword: string
  body: string
  faq: { q: string; a: string }[]
  status: string
  whyNow?: string
  sources: { title: string; url: string }[]
  claims: { claim: string; verdict: string; sourceUrl?: string; note?: string }[]
  problems: string[]
  words: number
}

export interface Changes {
  title: string
  description: string
  body: string
}

export function ReviewEditor({
  post,
  busy,
  onDecide,
}: {
  post: ReviewPost
  busy: boolean
  onDecide: (decision: 'publish' | 'reject' | 'save', changes: Changes) => void
}) {
  const [title, setTitle] = useState(post.title)
  const [description, setDescription] = useState(post.description)
  const [body, setBody] = useState(post.body)
  const [tab, setTab] = useState<'preview' | 'edit'>('preview')
  const blocks = useMemo(() => parseMarkdown(body), [body])
  const changes = { title, description, body }
  const pending = post.status === 'pending'

  const verified = post.claims.filter((claim) => claim.verdict === 'verified').length
  const flagged = post.claims.filter((claim) => claim.verdict !== 'verified')

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <p className="text-sm font-semibold text-foreground">Fact check</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {post.claims.length === 0
              ? 'No claims were recorded. Check the post by hand.'
              : `${verified} of ${post.claims.length} claims verified.`}
          </p>
          {flagged.length > 0 && (
            <ul className="mt-3 space-y-2 text-sm">
              {flagged.map((item, index) => (
                <li key={index} className="border-t border-border pt-2">
                  <span className={cn('font-medium', item.verdict === 'wrong' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')}>{item.verdict}</span>{' '}
                  <span className="text-foreground">{item.claim}</span>
                  {item.note && <span className="block text-muted-foreground">{item.note}</span>}
                  {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noopener" className="block truncate text-xs text-accent underline">{item.sourceUrl}</a>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-sm font-semibold text-foreground">Style checks still failing</p>
          {post.problems.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">None.</p>
          ) : (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {post.problems.map((problem, index) => <li key={index}>{problem}</li>)}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {post.words} words · search phrase: {post.keyword}{post.whyNow ? ` · why now: ${post.whyNow}` : ''}
          </p>
        </Card>
      </div>

      <div className="flex gap-1 rounded-lg border border-border p-1 w-fit" role="tablist">
        {(['preview', 'edit'] as const).map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={cn('rounded-md px-4 py-1 text-sm capitalize transition-colors', tab === name ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === 'edit' ? (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-foreground">
            Title
            <Input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1" maxLength={120} />
          </label>
          <label className="block text-sm font-medium text-foreground">
            Description ({description.length} characters)
            <Input value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1" maxLength={200} />
          </label>
          <label className="block text-sm font-medium text-foreground">
            Body (Markdown)
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={28}
              spellCheck
              className="mt-1 w-full rounded-md border border-border bg-background p-3 font-mono text-sm leading-relaxed"
            />
          </label>
        </div>
      ) : (
        <article className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-muted-foreground">{description}</p>
          <div className="mt-8"><Prose blocks={blocks} /></div>
          {post.faq.length > 0 && (
            <section className="mt-10">
              <h2 className="text-xl font-semibold text-foreground">Frequently asked questions</h2>
              <dl className="mt-3 space-y-4">
                {post.faq.map((item) => (
                  <div key={item.q}>
                    <dt className="font-medium text-foreground">{item.q}</dt>
                    <dd className="text-[15px] text-muted-foreground">{item.a}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {post.sources.length > 0 && (
            <section className="mt-10">
              <h2 className="text-lg font-semibold text-foreground">Sources</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {post.sources.map((source) => (
                  <li key={source.url}><a href={source.url} target="_blank" rel="noopener" className="text-accent underline">{source.title}</a></li>
                ))}
              </ul>
            </section>
          )}
        </article>
      )}

      {pending ? (
        <div className="sticky bottom-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
          <Button disabled={busy} onClick={() => onDecide('publish', changes)} className="bg-accent text-accent-foreground hover:bg-accent/90">
            Publish
          </Button>
          <Button disabled={busy} variant="outline" onClick={() => onDecide('save', changes)}>
            Save edits
          </Button>
          <Button disabled={busy} variant="ghost" onClick={() => onDecide('reject', changes)} className="ml-auto text-muted-foreground">
            Reject
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">This post is {post.status}.</p>
      )}
    </div>
  )
}
