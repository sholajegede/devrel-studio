import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingNav } from '@/components/marketing/nav'
import { MarketingFooter } from '@/components/marketing/footer'
import { ArrowRight, LifeBuoy, Mail, MessageSquare } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Contact · DevRel Studio',
  description: 'Get help with DevRel Studio, ask a pre-sales question, or report a problem.',
}

// Deliberately not a contact form. A form here would need a backend, a spam
// defence and a queue nobody is watching yet — and it would be slower for the
// sender than the mail client they already have open. One address, three
// reasons to use it, and an honest response time.

const REASONS = [
  {
    icon: LifeBuoy,
    title: 'Something is broken',
    body: 'Include what you were doing and, if an error screen appeared, the reference code shown on it. That code points straight at the failure in our logs.',
  },
  {
    icon: MessageSquare,
    title: 'A question before buying',
    body: 'Whether it fits your workflow, how client dashboards work, what happens at the plan limits. Happy to answer before you spend anything.',
  },
  {
    icon: Mail,
    title: 'Refunds and billing',
    body: 'Full refund within 14 days of purchase, no explanation needed. Just say which email you bought with.',
  },
]

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      <section className="mx-auto max-w-3xl px-6 pt-24 pb-16 text-center">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Contact
        </span>
        <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-[-0.03em] text-foreground leading-[1.1]">
          Talk to a human
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
          One address, read by the person who builds this. Most messages get an answer within a
          working day.
        </p>

        <a
          href="mailto:support@devrel.studio"
          className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-foreground px-6 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          <Mail className="h-4 w-4" />
          support@devrel.studio
        </a>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
          {REASONS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-background p-7">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <h2 className="mt-4 text-[15px] font-medium text-foreground">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-border p-7 text-center">
          <p className="text-[15px] text-foreground">Not ready to email?</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            The pricing page answers most commercial questions, and the demo dashboard shows
            exactly what a client sees without you signing up for anything.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Link
              href="/pricing"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              See pricing
            </Link>
            <Link
              href="/demo"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Explore the demo
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
