import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // `ignoreBuildErrors` was on, which meant a type error shipped to production
  // silently. `tsc --noEmit` is clean and runs in CI, so the build enforcing it
  // costs nothing and closes the gap between "tests pass" and "deploy is safe".
  typescript: {
    ignoreBuildErrors: false,
  },

  images: {
    // Avatars come from whichever identity provider the user signed in with, and
    // portfolio links point at arbitrary hosts, so the allowlist is broad by
    // necessity. Optimisation is still worth having: these are the hosts that
    // actually appear, and anything else falls back to being served as-is.
    remotePatterns: [
      { protocol: 'https', hostname: '**.gravatar.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: '**.kinde.com' },
      { protocol: 'https', hostname: '**.githubusercontent.com' },
      { protocol: 'https', hostname: '**.convex.cloud' },
    ],
    // A profile picture is never rendered larger than this.
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  serverExternalPackages: ['@react-pdf/renderer'],
}

/**
 * Sentry's build step, applied only once a project exists to point it at.
 *
 * Two things it does that the runtime SDK cannot. It uploads source maps, so a
 * production stack trace names a line in this repository rather than a column
 * in a minified chunk — without it an error report is barely worth reading. And
 * it serves the SDK through `/monitoring` on this domain, so an ad blocker
 * cannot quietly drop the reports; blockers already interfere here, which is
 * how the portfolio page's ERR_BLOCKED_BY_CLIENT turned up.
 *
 * Conditional on the org and project being set, so a build before Sentry is
 * provisioned is exactly the build it is today, with no warnings about
 * credentials it has not been given. Uploads additionally need
 * SENTRY_AUTH_TOKEN, which is a build-time secret and separate from the DSN.
 */
const sentryConfigured = Boolean(process.env.SENTRY_ORG && process.env.SENTRY_PROJECT)

export default sentryConfigured
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // Widens the set of client files uploaded, which materially improves
      // client-side stack traces.
      widenClientFileUpload: true,
      // Must stay in step with the public-route list in proxy.ts, or every
      // report is redirected to the sign-in page instead of reaching Sentry.
      tunnelRoute: '/monitoring',
      silent: !process.env.CI,
    })
  : nextConfig
