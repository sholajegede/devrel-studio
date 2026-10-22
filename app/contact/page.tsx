import type { Metadata } from 'next'
import { MarketingNav } from '@/components/marketing/nav'
import { MarketingFooter } from '@/components/marketing/footer'
import { Display, Lede, OutlineLink, PrimaryLink, Wrap } from '@/components/marketing/primitives'
import { Shape, type ShapeColor, type ShapeName } from '@/components/marketing/shapes'

export const metadata: Metadata = {
  title: 'Contact · DevRel Studio',
  description: 'Get help with DevRel Studio, ask a question before you buy, or report a problem.',
}

// Deliberately not a contact form. A form needs a backend, a spam defence and a
// queue nobody watches yet, and it is slower than the mail client already open.
// One address, three reasons to use it, and an honest response time.

const REASONS: { title: string; body: string; tone: string; shape: ShapeName; color: ShapeColor }[] = [
  {
    title: 'Something is broken',
    body: 'Tell us what you were doing. If an error screen appeared, send the reference code on it. That code points straight at the failure in our logs.',
    tone: 'bg-ochre',
    shape: 'cross',
    color: 'ink',
  },
  {
    title: 'A question before you buy',
    body: 'Ask how client dashboards work, or what happens at the plan limits. We answer before you spend anything.',
    tone: 'bg-blue',
    shape: 'dome',
    color: 'ink',
  },
  {
    title: 'Refunds and billing',
    body: 'We refund any payment within 14 days. Tell us which email you bought with.',
    tone: 'bg-sand',
    shape: 'circle',
    color: 'orange',
  },
]

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      <section className="px-4 pb-14 pt-12 text-center sm:px-8 sm:pt-20">
        <Display as="h1" size="xl">
          Talk to us about
          <br />
          your program
        </Display>
        <Lede className="mt-7">Evaluating DevRel Studio for a team, an agency or an enterprise program? Write to us. Most messages get an answer within one working day.</Lede>
        <div className="mt-9 flex justify-center">
          <PrimaryLink href="mailto:support@devrel.studio" arrow={false}>
            support@devrel.studio
          </PrimaryLink>
        </div>
      </section>

      <Wrap className="pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          {REASONS.map(({ title, body, tone, shape, color }) => (
            <div key={title} className={`flex min-h-[22rem] flex-col rounded-[2rem] p-8 ${tone}`}>
              <Shape name={shape} color={color} className="h-16 w-16" />
              <div className="mt-auto pt-10">
                <h2 className="text-3xl font-medium leading-[1.05] tracking-[-0.035em] text-ink">{title}</h2>
                <p className="mt-3 text-[15px] leading-relaxed text-ink/75">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-[2rem] bg-sand p-8 text-center sm:p-12">
          <h2 className="text-3xl font-medium tracking-[-0.035em] text-foreground">Looking for an answer faster?</h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            The pricing page answers most questions about cost. The demo shows what a client sees, and needs no sign-up.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <OutlineLink href="/pricing">See pricing</OutlineLink>
            <OutlineLink href="/demo" arrow>
              Explore the demo
            </OutlineLink>
          </div>
        </div>
      </Wrap>

      <MarketingFooter />
    </div>
  )
}
