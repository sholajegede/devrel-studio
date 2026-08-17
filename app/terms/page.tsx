import type { Metadata } from 'next'
import { LegalPage, Section } from '@/components/marketing/legal-page'

export const metadata: Metadata = {
  title: 'Terms of Service · DevRel Studio',
  description: 'The terms under which DevRel Studio is sold and used.',
}

// These mirror the commercial promises made on the pricing page — one-time fee,
// 12 months of updates, 14-day refund. If that copy changes, this has to change
// with it. Needs review by someone qualified before being relied on.

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="17 August 2026"
      intro="These terms cover buying and using DevRel Studio. Plain language is intended; where it is ambiguous, the reading that favours you applies."
    >
      <Section heading="What you are buying">
        <p>
          A licence to use DevRel Studio, paid once rather than by subscription. There is no
          recurring charge and no renewal. The plan you buy sets how many client workspaces,
          content entries and team seats your account may use.
        </p>
        <p>
          Updates are included for 12 months from the date of purchase. After that the software
          continues to work; new features may require a further purchase.
        </p>
      </Section>

      <Section heading="Upgrades">
        <p>
          Moving to a higher plan is a separate one-time purchase at that plan&apos;s price. Your
          existing plan stays active until the upgrade completes. Plans do not move downward.
        </p>
      </Section>

      <Section heading="Refunds">
        <p>
          Full refund within 14 days of purchase, for any reason, by emailing
          support@devrel.studio. We do not require an explanation. After 14 days, refunds are at
          our discretion.
        </p>
      </Section>

      <Section heading="Your content">
        <p>
          You own everything you put into DevRel Studio. We claim no rights over it, and we do
          not use it to train anything or share it with anyone beyond the sub-processors listed
          in the{' '}
          <a href="/privacy" className="text-foreground underline underline-offset-4">
            Privacy Policy
          </a>
          .
        </p>
        <p>
          You are responsible for what you publish through the product — including anything made
          visible on a client dashboard or a public portfolio.
        </p>
      </Section>

      <Section heading="Acceptable use">
        <p>
          Do not use DevRel Studio to store or publish unlawful content, to impersonate someone,
          or to attempt to access workspaces that are not yours. We may suspend an account that
          does, and will explain why.
        </p>
      </Section>

      <Section heading="Availability">
        <p>
          We aim to keep the service running continuously but do not guarantee uninterrupted
          availability. Planned maintenance that requires downtime will be announced in advance
          where practical.
        </p>
        <p>
          Client dashboards and public portfolios depend on the same infrastructure; an outage
          affects them too.
        </p>
      </Section>

      <Section heading="Liability">
        <p>
          DevRel Studio is provided as-is. To the extent the law allows, our total liability is
          limited to what you paid for your licence. We are not liable for indirect losses, or
          for lost data you have not exported — export is available at any time, in CSV and PDF.
        </p>
      </Section>

      <Section heading="Ending your use">
        <p>
          You can delete your account at any time from Settings, which removes your data
          immediately. Deleting your account does not by itself entitle you to a refund outside
          the 14-day window.
        </p>
      </Section>

      <Section heading="Changes to these terms">
        <p>
          We will email you before any change that materially affects what you bought. Continued
          use after that point means the updated terms apply.
        </p>
      </Section>
    </LegalPage>
  )
}
