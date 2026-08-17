import type { Metadata } from 'next'
import { LegalPage, Section } from '@/components/marketing/legal-page'

export const metadata: Metadata = {
  title: 'Privacy Policy · DevRel Studio',
  description: 'What DevRel Studio stores, why we store it, and who else can see it.',
}

// Written against what the application actually does. The sub-processors below
// are the services this code really talks to, not a generic list. Stripe is not
// among them: payments happen by bank transfer, so no card processor sees
// anything. Someone qualified should still review this before we rely on it.

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="17 August 2026"
      intro="DevRel Studio tracks content you produce for clients. This page says what it stores, why we store it, and who else can see it."
    >
      <Section heading="What we collect">
        <p>
          <strong className="text-foreground">Account details.</strong> Your name, email address
          and profile picture. Your sign-in provider sends these when you sign in. We never see
          your password.
        </p>
        <p>
          <strong className="text-foreground">Content you enter.</strong> Your clients, entries,
          links, notes, numbers and retainer figures. This is your data. We store it so the
          product can show it back to you.
        </p>
        <p>
          <strong className="text-foreground">Payment records.</strong> We store which plan you
          bought and when your access ends. We handle payments by bank transfer, so we never
          hold a card number.
        </p>
        <p>
          <strong className="text-foreground">Technical logs.</strong> Errors and timing data,
          which we use to find and fix faults. We do not record your screen.
        </p>
      </Section>

      <Section heading="What we do not collect">
        <p>
          We run no advertising trackers. We sell no data. We build no marketing profiles.
          No third-party script follows you between sites.
        </p>
      </Section>

      <Section heading="Who can see your content">
        <p>
          By default, only you. Three things make content visible to others. You control all
          three.
        </p>
        <p>
          <strong className="text-foreground">Client dashboards.</strong> Anyone holding the URL
          can read the entries tagged to that client. You can ask for an access code, and you
          can revoke it at any time.
        </p>
        <p>
          <strong className="text-foreground">Public portfolio.</strong> If you claim a handle,
          entries marked Published appear at a public address. Drafts, scheduled work, notes,
          tracking links and client names stay private.
        </p>
        <p>
          <strong className="text-foreground">Workspace members.</strong> People you invite see
          the workspace you invited them to. The role you give them sets what they can do.
        </p>
      </Section>

      <Section heading="Sub-processors">
        <p>
          These services process data for us. Each one does a single job:
        </p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>Kinde, for sign-in</li>
          <li>Convex, for the database and server functions</li>
          <li>Vercel, for hosting</li>
          <li>Resend, for email</li>
          <li>Sentry, for error reports</li>
        </ul>
      </Section>

      <Section heading="Retention and deletion">
        <p>
          We keep your data while your account exists. Deleting your account from Settings
          removes your profile, your entries, your clients and any live dashboard sessions.
          Deletion happens at once and cannot be undone.
        </p>
      </Section>

      <Section heading="Your rights">
        <p>
          Export your content as CSV or PDF at any time from inside the product. Correct it by
          editing it. Delete it by deleting your account. For a copy of everything we hold, or
          a specific deletion request, email support@devrel.studio.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          If a change to this page affects how we handle your data, we email you before it
          takes effect.
        </p>
      </Section>
    </LegalPage>
  )
}
