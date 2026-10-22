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
      <header className="mb-14 text-center">
        <h1 className="text-[clamp(2.75rem,7vw,5.25rem)] font-medium leading-[1] tracking-[-0.035em] text-foreground">
          Notes on proving
          <br />
          DevRel work
        </h1>
        <p className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground">{DESCRIPTION}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          <a href="/blog/feed.xml" className="underline underline-offset-4 decoration-ink/30 hover:text-accent hover:decoration-accent">RSS feed</a>
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="rounded-[2rem] bg-sand p-12 text-center text-muted-foreground">
          The first posts are on the way.
        </p>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link href={`/blog/${post.slug}`} className="block rounded-[2rem] bg-sand p-7 transition-colors hover:bg-sand-deep sm:p-9">
                <p className="text-sm text-muted-foreground">
                  {dateLabel(post.publishedAt)} · {post.readingMinutes} min read
                </p>
                <h2 className="mt-2 text-2xl font-medium leading-[1.1] tracking-[-0.03em] text-foreground sm:text-3xl">{post.title}</h2>
                <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{post.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BlogShell>
  )
}
