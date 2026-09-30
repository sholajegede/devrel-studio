import type { Metadata } from 'next'
import Link from 'next/link'
import { BlogShell, dateLabel } from '@/components/blog/shell'
import { JsonLd } from '@/components/jobs/shell'
import { loadPosts } from '@/lib/blog/server'
import { breadcrumbLd } from '@/lib/jobs/seo'
import { siteOrigin } from '@/lib/site'

export const revalidate = 3600

const TITLE = 'The DevRel Studio blog: jobs, careers and proving your work'
const DESCRIPTION = 'Practical writing for developer advocates and DevRel managers. How to find roles, read pay, build a portfolio and show the value of your work.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${siteOrigin()}/blog`, types: { 'application/rss+xml': `${siteOrigin()}/blog/feed.xml` } },
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website' },
}

export default async function BlogIndex() {
  const posts = await loadPosts()
  const origin = siteOrigin()

  return (
    <BlogShell>
      <JsonLd data={breadcrumbLd(origin, [{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }])} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: 'DevRel Studio blog',
          url: `${origin}/blog`,
          description: DESCRIPTION,
          blogPost: posts.slice(0, 20).map((post) => ({
            '@type': 'BlogPosting',
            headline: post.title,
            url: `${origin}/blog/${post.slug}`,
            datePublished: new Date(post.publishedAt).toISOString(),
          })),
        }}
      />
      <header className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">The DevRel Studio blog</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{DESCRIPTION}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          <a href="/blog/feed.xml" className="underline underline-offset-2 hover:text-foreground">RSS feed</a>
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          The first posts are on the way.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {posts.map((post) => (
            <li key={post.slug} className="py-6 first:pt-0">
              <p className="text-xs text-muted-foreground">
                {dateLabel(post.publishedAt)} · {post.readingMinutes} min read
              </p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">
                <Link href={`/blog/${post.slug}`} className="hover:underline">{post.title}</Link>
              </h2>
              <p className="mt-2 text-muted-foreground">{post.description}</p>
            </li>
          ))}
        </ul>
      )}
    </BlogShell>
  )
}
