import type { Metadata } from 'next'
import { LegalPage, Section } from '@/components/marketing/legal-page'

export const metadata: Metadata = {
  title: 'Terms of Service · DevRel Studio',
  description: 'The terms you agree to when you buy and use DevRel Studio.',
}

// These mirror the commercial promises made on the pricing page — monthly
// pricing sold in terms, manual payment, 14-day refund. If that copy changes,
// this has to change with it. Needs review by someone qualified before being
// relied on.

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="17 August 2026"
      intro="These terms cover buying and using DevRel Studio. Where the wording is unclear, the reading that favours you applies."
    >
      <Section heading="What you are buying">
        <p>
          Access to DevRel Studio for a fixed period. We price it per month. You buy one,
          three, six or twelve months at a time. Your plan sets how many clients, entries and
          seats you get.
        </p>
        <p>
          We handle payment directly, not through a card processor. You tell us the plan and
          the term. We send transfer details. Access opens when the payment arrives.
        </p>
      </Section>

      <Section heading="Changing plan and extending">
        <p>
          Move to a different plan at any time. It applies from that point. If you extend
          before your period ends, we add the time to it. You never lose days you paid for.
        </p>
        <p>
          When a period ends, your content stays and your clients keep their dashboards. You
          cannot add or edit until you extend.
        </p>
      </Section>

      <Section heading="Refunds">
        <p>
          Email support@devrel.studio within 14 days of a payment and we refund it, for any
          reason. We do not ask why. After 14 days, we decide case by case.
        </p>
      </Section>

      <Section heading="Your content">
        <p>
          You own everything you put into DevRel Studio. We claim no rights over it. We do not
          train anything on it. We share it with nobody beyond the sub-processors listed in
          the{' '}
          <a href="/privacy" className="text-foreground underline underline-offset-4">
            Privacy Policy
          </a>
          .
        </p>
        <p>
          You are responsible for what you publish, including anything visible on a client
          dashboard or a public portfolio.
        </p>
      </Section>

      <Section heading="Acceptable use">
        <p>
          Do not use DevRel Studio to store or publish unlawful content. Do not impersonate
          anyone. Do not try to reach workspaces that are not yours. We suspend accounts that
          do, and we say why.
        </p>
      </Section>

      <Section heading="Availability">
        <p>
          We aim to keep the service running, but we do not promise it never stops. We
          announce planned downtime in advance where we can.
        </p>
        <p>
          Client dashboards and public portfolios run on the same infrastructure. An outage
          affects them too.
        </p>
      </Section>

      <Section heading="Liability">
        <p>
          We provide DevRel Studio as-is. As far as the law allows, we limit our total
          liability to what you paid for your current period. We are not liable for indirect
          losses. We are not liable for data you did not export, and you can export at any
          time in CSV or PDF.
        </p>
      </Section>

      <Section heading="Ending your use">
        <p>
          Delete your account at any time from Settings. That removes your data at once.
          Deleting an account does not by itself earn a refund outside the 14-day window. We do
          not refund unused time on a period automatically. Email us and we look at it.
        </p>
      </Section>

      <Section heading="Changes to these terms">
        <p>
          We email you before any change that affects what you bought. If you keep using the
          product after that, the new terms apply.
        </p>
      </Section>
    </LegalPage>
  )
}
