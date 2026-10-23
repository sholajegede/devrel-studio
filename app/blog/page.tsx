import type { Metadata } from 'next'
import Link from 'next/link'
import { BlogShell, dateLabel } from '@/components/blog/shell'
import { Cover } from '@/components/blog/cover'
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
  const [featured, ...rest] = posts

  return (
    <BlogShell wide>
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
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-ink/10 pb-10 sm:pb-14">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">[ Engineering blog ]</p>
          <h1 className="mt-5 max-w-4xl text-[clamp(2.5rem,6vw,4.75rem)] font-medium leading-[1.02] tracking-[-0.035em] text-foreground">
            Notes on proving DevRel work
          </h1>
          <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">{DESCRIPTION}</p>
            <p className="shrink-0 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {posts.length} {posts.length === 1 ? 'post' : 'posts'} ·{' '}
              <a href="/blog/feed.xml" className="underline underline-offset-4 decoration-ink/30 hover:text-accent hover:decoration-accent">
                RSS
              </a>
            </p>
          </div>
        </header>

        {posts.length === 0 ? (
          <p className="mt-12 rounded-[2rem] bg-sand p-12 text-center text-muted-foreground">The first posts are on the way.</p>
        ) : (
          <>
            <Link
              href={`/blog/${featured.slug}`}
              className="group mt-10 grid gap-6 sm:mt-14 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-12"
            >
              <Cover slug={featured.slug} size="lg" className="aspect-[16/10] w-full" />
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Latest{featured.keyword ? ` · ${featured.keyword}` : ''}
                </p>
                <h2 className="mt-4 text-3xl font-medium leading-[1.08] tracking-[-0.03em] text-foreground group-hover:text-accent sm:text-4xl">
                  {featured.title}
                </h2>
                <p className="mt-4 line-clamp-4 text-base leading-relaxed text-muted-foreground">{featured.description}</p>
                <p className="mt-6 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {dateLabel(featured.publishedAt)} · {featured.readingMinutes} min read
                </p>
              </div>
            </Link>

            {rest.length > 0 && (
              <section aria-label="All posts" className="mt-16 border-t border-ink/10 pt-10 sm:mt-20">
                <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">[ All posts ]</h2>
                <ul className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((post) => (
                    <li key={post.slug}>
                      <Link href={`/blog/${post.slug}`} className="group flex h-full flex-col">
                        <Cover slug={post.slug} className="aspect-[16/10] w-full" />
                        {post.keyword && (
                          <p className="mt-5 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">{post.keyword}</p>
                        )}
                        <h3 className="mt-2 text-xl font-medium leading-[1.2] tracking-[-0.02em] text-foreground group-hover:text-accent">
                          {post.title}
                        </h3>
                        <p className="mt-3 line-clamp-3 text-[15px] leading-relaxed text-muted-foreground">{post.description}</p>
                        <p className="mt-auto pt-5 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                          {dateLabel(post.publishedAt)} · {post.readingMinutes} min read
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </BlogShell>
  )
}
