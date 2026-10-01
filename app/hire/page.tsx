import type { Metadata } from 'next'
import { BlogShell } from '@/components/blog/shell'
import { JsonLd } from '@/components/jobs/shell'
import { TalentDirectory } from '@/components/hire/talent-directory'
import { loadTalent } from '@/lib/hire/server'
import { breadcrumbLd } from '@/lib/jobs/seo'
import { siteOrigin } from '@/lib/site'

export const revalidate = 300

const TITLE = 'Hire a developer advocate: DevRels open to work'
const DESCRIPTION = 'Developer advocates, DevRel engineers and community leads who chose to be listed. Filter by skills, level, country and availability, and see the work each one has published.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${siteOrigin()}/hire` },
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website' },
}

export default async function HirePage() {
  const people = await loadTalent()
  const origin = siteOrigin()

  return (
    <BlogShell wide>
      <JsonLd data={breadcrumbLd(origin, [{ name: 'Home', path: '/' }, { name: 'Hire', path: '/hire' }])} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'DevRels listed on DevRel Studio',
          itemListElement: people.slice(0, 50).map((person, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: `${origin}/hire/${person.handle}`,
            name: person.name,
          })),
        }}
      />
      <header className="mb-10 max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">Hire a developer advocate</h1>
        <p className="mt-3 text-lg text-muted-foreground">{DESCRIPTION}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          Everyone here switched on their listing. Each profile shows the work they track on DevRel Studio, and you contact them through the form on their page.
        </p>
      </header>
      <TalentDirectory people={people} />
    </BlogShell>
  )
}
