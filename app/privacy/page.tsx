import type { Metadata } from 'next'
import { LegalPage, Section } from '@/components/marketing/legal-page'

export const metadata: Metadata = {
  title: 'Privacy Policy · DevRel Studio',
  description: 'What DevRel Studio collects, why, and who it is shared with.',
}

// Written against what the application actually does — the sub-processors named
// below are the services the code genuinely talks to (Kinde, Convex, Vercel,
// Stripe, Resend, Sentry), not a generic list. It still needs review by someone
// qualified before it is relied on as a legal commitment.

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="17 August 2026"
      intro="DevRel Studio is a tool for tracking content you produce for clients. This page describes what it stores, why, and who else can see it."
    >
      <Section heading="What we collect">
        <p>
          <strong className="text-foreground">Account details.</strong> Your name, email address
          and profile picture, provided by your identity provider when you sign in. We never
          receive or store your password.
        </p>
        <p>
          <strong className="text-foreground">Content you enter.</strong> The clients, content
          entries, links, notes, metrics and retainer figures you add. This is your data; we
          store it so the product can show it back to you.
        </p>
        <p>
          <strong className="text-foreground">Payment records.</strong> If you buy a plan, our
          payment processor handles the transaction. We store which plan you bought and a
          customer reference — never your card number.
        </p>
        <p>
          <strong className="text-foreground">Technical logs.</strong> Errors and performance
          traces, used to find and fix faults. Session recording is deliberately not enabled.
        </p>
      </Section>

      <Section heading="What we do not collect">
        <p>
          We do not run advertising trackers, sell data, or build profiles for marketing. There
          is no third-party analytics script following you between sites.
        </p>
      </Section>

      <Section heading="Who can see your content">
        <p>
          By default, only you. Content becomes visible to others in three ways, each of which
          you control:
        </p>
        <p>
          <strong className="text-foreground">Client dashboards.</strong> When you give a client
          a dashboard, anyone holding its URL can read the entries tagged to that client. You
          can require an access code, and you can revoke it at any time.
        </p>
        <p>
          <strong className="text-foreground">Public portfolio.</strong> If you claim a handle,
          entries marked Published appear at a public address. Drafts, scheduled work, private
          notes, tracking links and client names are never included.
        </p>
        <p>
          <strong className="text-foreground">Workspace members.</strong> People you invite can
          see the workspace you invited them to, limited by the role you assign.
        </p>
      </Section>

      <Section heading="Sub-processors">
        <p>
          These services process data on our behalf. Each is used for one purpose:
        </p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>Kinde — authentication</li>
          <li>Convex — database and server functions</li>
          <li>Vercel — application hosting</li>
          <li>Stripe — payments</li>
          <li>Resend — transactional email</li>
          <li>Sentry — error monitoring</li>
        </ul>
      </Section>

      <Section heading="Retention and deletion">
        <p>
          Your data is kept while your account exists. Deleting your account from Settings
          removes your profile, content entries, clients and any live client dashboard
          sessions. Deletion is immediate and cannot be undone.
        </p>
      </Section>

      <Section heading="Your rights">
        <p>
          You can export your content as CSV or PDF at any time from inside the product, correct
          it by editing it, and delete it by deleting your account. For anything else — a copy
          of what we hold, or a specific deletion request — email support@devrel.studio.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          If this policy changes in a way that materially affects how your data is handled, we
          will say so by email before it takes effect.
        </p>
      </Section>
    </LegalPage>
  )
}
